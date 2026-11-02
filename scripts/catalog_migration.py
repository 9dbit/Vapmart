#!/usr/bin/env python3
"""Read-only WordPress audit and draft-only replacement-catalog CSV validator.

Standard library only. No network, database, WordPress writes, or publication.
Legacy product titles/SKUs remain private and are excluded from audit output.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlparse
from zipfile import ZipFile

LEGACY_FEED = re.compile(r"^wp-content/uploads/facebook_for_woocommerce/product_catalog_[\w-]+\.csv$")
LEGACY_REQUIRED = {"id","item_group_id","title","image_link","price","product_type","availability"}
NEW_REQUIRED = {"sku","slug","name","description","category","price_idr","stock_qty"}
NEW_ALLOWED = NEW_REQUIRED | {"image_url","is_active"}
CATEGORIES = {"home","lifestyle","decor","accessories","electronics","other"}
RESTRICTED = re.compile(r"(?i)\b(nicotine|nikotin|vape|vaping|rokok|tobacco|tembakau|cigarettes?|e-cig|e-liquid|e-juice|saltnic|iqos|vaporizer|atomizer|shisha|hookah|pod\s*(?:kit|system))\b")

class CatalogError(ValueError):
    pass

def csv_rows(data):
    try:
        stream=io.StringIO(data.decode("utf-8-sig"),newline="")
        reader=csv.DictReader(stream,strict=True)
        fields=[x.strip() for x in (reader.fieldnames or [])]
        if not fields or len(set(fields))!=len(fields) or any(not x for x in fields):
            raise CatalogError("Invalid CSV header")
        reader.fieldnames=fields
        rows=[]
        for n,row in enumerate(reader,2):
            if None in row or any(v is None for v in row.values()):
                raise CatalogError(f"Row {n}: malformed CSV")
            rows.append({k:v.strip() for k,v in row.items()})
        return fields,rows
    except (UnicodeError,csv.Error) as e:
        raise CatalogError("Invalid UTF-8 CSV input") from e

def archive_image_path(link):
    try:
        url=urlparse(link)
        path=unquote(url.path).lstrip("/")
        if url.scheme=="https" and url.hostname in {"vapmart.co.id","www.vapmart.co.id"} and path.startswith("wp-content/uploads/") and ".." not in path.split("/"):
            return path
    except ValueError:
        pass
    return None

def audit_wordpress(zipfile_path):
    with ZipFile(zipfile_path) as archive:
        matches=[n for n in archive.namelist() if LEGACY_FEED.fullmatch(n)]
        if len(matches)!=1:
            raise CatalogError(f"Expected one WordPress Facebook feed, found {len(matches)}")
        name=matches[0]
        raw=archive.read(name)
        fields,rows=csv_rows(raw)
        missing=LEGACY_REQUIRED-set(fields)
        if missing:
            raise CatalogError("Missing legacy columns: "+", ".join(sorted(missing)))
        group_counts=Counter(r["item_group_id"] for r in rows)
        images=[archive_image_path(r["image_link"]) for r in rows]
        files=set(archive.namelist())
        ids=Counter(r["id"] for r in rows)
        return {
            "kind":"legacy_facebook_feed_readonly_audit",
            "eligible_for_active_import":False,
            "source_sha256":hashlib.sha256(raw).hexdigest(),
            "zip_entry_date":"-".join(map(str,archive.getinfo(name).date_time[:3])),
            "rows":len(rows),
            "unique_product_ids":len(ids),
            "duplicate_product_ids":sum(v-1 for v in ids.values() if v>1),
            "unique_product_groups":len(group_counts),
            "distinct_titles":len({r["title"] for r in rows}),
            "categories":dict(sorted(Counter(r["product_type"] for r in rows).items())),
            "availability":dict(sorted(Counter(r["availability"] for r in rows).items())),
            "brands":len({r.get("brand","") for r in rows if r.get("brand")}),
            "image_links":sum(bool(r["image_link"]) for r in rows),
            "matched_archive_images":sum(bool(p and p in files) for p in images),
            "unique_image_links":len({r["image_link"] for r in rows if r["image_link"]}),
            "sku_column_present":"sku" in fields,
            "gtin_populated":sum(bool(r.get("gtin","")) for r in rows),
            "stock_quantity_populated":sum(bool(r.get("quantity_to_sell_on_facebook","")) for r in rows),
            "sale_price_populated":sum(bool(r.get("sale_price","")) for r in rows),
            "legacy_exposure":"archive_review_only; no product publication"
        }

def number(value,field,n):
    if not re.fullmatch(r"\d+",value) or int(value)>2_000_000_000:
        raise CatalogError(f"Row {n}: invalid {field}")
    return int(value)

def prepare_replacement(data):
    fields,rows=csv_rows(data)
    if NEW_REQUIRED-set(fields) or set(fields)-NEW_ALLOWED:
        raise CatalogError("Invalid replacement CSV columns")
    if not rows:
        raise CatalogError("Replacement CSV is empty")
    seen_sku=set()
    seen_slug=set()
    result=[]
    for n,row in enumerate(rows,2):
        sku,slug,name=row["sku"],row["slug"],row["name"]
        description=row["description"]
        category=row["category"]
        img=row.get("image_url","")
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9._-]{2,63}",sku):
            raise CatalogError(f"Row {n}: invalid SKU")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*",slug) or len(slug)>120:
            raise CatalogError(f"Row {n}: invalid slug")
        if sku in seen_sku or slug in seen_slug:
            raise CatalogError(f"Row {n}: duplicate SKU or slug")
        seen_sku.add(sku)
        seen_slug.add(slug)
        if len(name)<2 or len(name)>140 or len(description)>3000:
            raise CatalogError(f"Row {n}: invalid title or description")
        if category not in CATEGORIES:
            raise CatalogError(f"Row {n}: invalid category")
        if RESTRICTED.search(" ".join((sku,slug,name,description))):
            raise CatalogError(f"Row {n}: restricted product cannot enter replacement catalog")
        if row.get("is_active","").lower() not in {"","0","false","no"}:
            raise CatalogError(f"Row {n}: active publication is forbidden during import")
        if img:
            try:
                url=urlparse(img)
            except ValueError as e:
                raise CatalogError(f"Row {n}: invalid image URL") from e
            if url.scheme!="https" or not url.hostname or url.username or url.password or len(img)>500:
                raise CatalogError(f"Row {n}: image URL must be HTTPS")
            if "/legacy/" in url.path.lower() or (url.hostname in {"vapmart.co.id","www.vapmart.co.id"} and url.path.startswith("/wp-content/uploads/")):
                raise CatalogError(f"Row {n}: historical product image reuse is forbidden")
        result.append({
            "sku":sku,"slug":slug,"name":name,"description":description,
            "category":category,"price_idr":number(row["price_idr"],"price_idr",n),
            "stock_qty":number(row["stock_qty"],"stock_qty",n),
            "image_url":img or None,"is_active":False
        })
    return result

def main():
    parser=argparse.ArgumentParser(description="Vapmart offline catalog inspection")
    sub=parser.add_subparsers(dest="mode",required=True)
    p=sub.add_parser("audit-wordpress")
    p.add_argument("--zip",required=True,type=Path)
    p.add_argument("--out",type=Path)
    p=sub.add_parser("prepare-replacement")
    p.add_argument("--csv",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    a=parser.parse_args()
    try:
        if a.mode=="audit-wordpress":
            data=audit_wordpress(a.zip)
            if a.out:
                a.out.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")
            print("VAPMART_LEGACY_AUDIT",json.dumps(data,sort_keys=True))
        else:
            items=prepare_replacement(a.csv.read_bytes())
            a.out.write_text(json.dumps({"kind":"replacement_drafts","items":items},indent=2)+"\n",encoding="utf-8")
            print("VAPMART_DRAFT_READY",json.dumps({"count":len(items),"published":0,"database_writes":0}))
    except (CatalogError,OSError) as e:
        print("VAPMART_CATALOG_BLOCKED",str(e),file=sys.stderr)
        return 2
    return 0

if __name__=="__main__":
    raise SystemExit(main())
