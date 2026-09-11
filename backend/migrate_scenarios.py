import json
import os

filepath = os.path.join(os.path.dirname(__file__), "attack_scenarios.json")

def migrate():
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    new_data = {}
    for key, scenario in data.items():
        require_same_asset = scenario.pop("require_same_asset", False)
        conditions = scenario.pop("conditions", [])
        
        scenario["max_hops"] = 1
        scenario["allowed_relation_types"] = [
            "shared_ip", "shared_tls_cert_san", "same_root_domain", 
            "dns_cname_chain", "shared_hosting_asn", "subdomain_naming_pattern"
        ]
        
        kill_chain = []
        tactics = ["initial-access", "execution", "persistence", "privilege-escalation"]
        
        for i, cond in enumerate(conditions):
            # For technique_refs, we'd normally look them up, but since they vary we can leave them empty or guess
            # Since the prompt asks to include technique_refs, we'll initialize an empty list
            stage = {
                "stage": i + 1,
                "tactic": tactics[i] if i < len(tactics) else "impact",
                "rule_keys": cond.get("rule_keys", []),
                "technique_refs": [],
                "require_same_asset": require_same_asset
            }
            kill_chain.append(stage)
            
        scenario["kill_chain"] = kill_chain
        new_data[key] = scenario

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(new_data, f, indent=2, ensure_ascii=False)

    print("Migration successful.")

if __name__ == "__main__":
    migrate()
