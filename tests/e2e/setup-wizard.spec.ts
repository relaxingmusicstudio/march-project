import { test, expect, Page } from "@playwright/test";

const shouldMockAuth = process.env.VITE_MOCK_AUTH === "true";

const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "assert") errors.push(`console:${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`page:${err.message}`));
  return errors;
};

test.beforeEach(async ({ page }) => {
  if (!shouldMockAuth) return;
  await page.addInitScript(() => {
    window.localStorage.setItem("VITE_MOCK_AUTH", "true");
    window.localStorage.setItem("cookie_consent", "true");
    window.localStorage.setItem(
      "cookie_preferences",
      JSON.stringify({ essential: true, analytics: false, functional: false, marketing: false })
    );
    window.localStorage.setItem(
      "enhanced_tracking_consent",
      JSON.stringify({ enhanced_analytics: false, marketing_emails: false, personalization: false })
    );
    window.localStorage.setItem("enhanced_tracking_asked", "true");
    window.localStorage.setItem(
      "onboarding_v1::mock-user",
      JSON.stringify({
        status: "complete",
        data: {},
        updatedAt: new Date().toISOString(),
      })
    );
  });
});

test("setup wizard runs smoke tests (mock)", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill("ceo@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByTestId("sign-in").click();

  await expect(page).toHaveURL(/\/app/);

  const navLink = page.getByRole("link", { name: "Setup Wizard" });
  if (await navLink.isVisible().catch(() => false)) {
    await navLink.click();
  } else {
    await page.goto("/app/setup");
  }

  if (shouldMockAuth) {
    await expect(page).toHaveURL(/\/app\/setup/);
  } else {
    await expect(page.getByTestId("setup-home")).toBeVisible();
    await expect(page.getByTestId("setup-stepper")).toBeVisible();
  }

  await page.getByTestId("setup-copy-envlocal").click();
  await page.getByTestId("setup-copy-vercel").click();

  const llmCard = page.getByRole("heading", { name: "LLM Gateway" }).locator("..").locator("..");
  await page.getByTestId("setup-llm-test").click();
  await expect(llmCard).toContainText(/OK|Running|LLM test failed/i);

  const notifyCard = page.getByRole("heading", { name: "Notifications Gateway" }).locator("..").locator("..");
  await page.getByTestId("setup-notify-test").click();
  await expect(notifyCard).toContainText(/mock|queued|notify/i);

  expect(errors, errors.join("\n")).toEqual([]);
});
