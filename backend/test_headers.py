import asyncio
import httpx

async def test_domain(sub):
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(f"http://{sub}")
            headers_preview = dict(list(resp.headers.items())[:10])
            print(f"\n--- {sub} ---")
            print(f"Status: {resp.status_code}")
            print(f"Server: {resp.headers.get('server')}")
            print(f"X-Powered-By: {resp.headers.get('x-powered-by')}")
            print(f"Headers: {headers_preview}")
    except Exception as e:
        print(f"\n--- {sub} ---")
        print(f"Error: {e}")

async def main():
    print("=== Testing azunix.ma (Homogeneous Shared Hosting) ===")
    domains_azunix = ["azunix.ma", "cpanel.azunix.ma", "webmail.azunix.ma", "webdisk.azunix.ma"]
    for d in domains_azunix:
        await test_domain(d)
        
    print("\n=== Testing heterogeneous domains (e.g. github.com / api.github.com) ===")
    domains_hetero = ["github.com", "api.github.com"]
    for d in domains_hetero:
        await test_domain(d)

if __name__ == "__main__":
    asyncio.run(main())
