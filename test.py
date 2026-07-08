import json
with open("temp.json") as f:
    data = json.load(f)
for r in data["data"]["items"]:
    print(r["name"], r.get("latitude"), r.get("longitude"))
