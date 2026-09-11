import json

with open("backend/risk_rules_content.json", "r", encoding="utf-8") as f:
    data = json.load(f)

mappings = {
    "dns_zone_transfer_exposed": ["T1590.002"],
    "subdomain_takeover_possible": ["T1584.001"],
    "spf_missing": ["T1566"],
    "spf_permissive": ["T1566"],
    "spf_softfail": ["T1566"],
    "dmarc_missing": ["T1566"],
    "dmarc_none": ["T1566"],
    "dkim_missing": ["T1566"],
    "admin_port_exposed": ["T1133"],
    "known_cve_detected": ["T1190"],
    "origin_ip_exposed": ["T1590"],
    "sensitive_file_exposed": ["T1592"]
}

for rule_key, techniques in mappings.items():
    if rule_key in data:
        data[rule_key]["attack_techniques"] = techniques

with open("backend/risk_rules_content.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
