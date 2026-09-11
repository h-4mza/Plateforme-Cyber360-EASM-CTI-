import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.modules.discovery.tasks import check_eol

tests = [
    {"techs": ["PHP (ou PHP/7.4.33)", "nginx/1.18.0 (Ubuntu)"]},
    {"techs": ["Apache/2.2.14"]},
    {"techs": ["PHP/8.1.0"]},
    {"techs": ["nginx/1.20.0"]},
    {"techs": ["OpenSSL/1.0.2k-fips"]},
    {"techs": ["WordPress/5.4.1"]}
]

for t in tests:
    is_eol, eol_since = check_eol(set(t["techs"]))
    print(f"Tech: {t['techs']} -> EOL: {is_eol}, Since: {eol_since}")
