import asyncio
from playwright.async_api import async_playwright

async def take_screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Create a 1080p page
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        print("Navigating to http://localhost:8000")
        await page.goto("http://localhost:8000")
        
        # Wait for the UI to fully render
        await page.wait_for_timeout(3000)
        
        print("Taking screenshot...")
        await page.screenshot(path="assets/demo-ui.png")
        
        await browser.close()
        print("Screenshot saved to assets/demo-ui.png")

asyncio.run(take_screenshot())
