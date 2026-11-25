import { test, expect, type Page } from '@playwright/test';
const switchTo = (page: Page, id: string) => page.getByLabel('Demo student').selectOption(id);
test('two classroom students match, request, chat, complete and review', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good to see you, Maya.' })).toBeVisible();
  await page.getByRole('link', { name: 'Find a study partner' }).click();
  await page.getByLabel('Subject', { exact: true }).selectOption('linear');
  await page.getByLabel('Topic', { exact: true }).fill('Eigenvalues and eigenvectors');
  await page.getByLabel('Education level').selectOption('undergrad');
  await page.getByLabel('Availability').selectOption('Weekday evenings');
  await page.getByLabel('Discovery area').selectOption('radius-5');
  await page.getByRole('button', { name: 'Find study partners' }).click();
  await expect(page.getByText('100 / 100 compatibility')).toBeVisible();
  await page.getByRole('button', { name: 'Send study request' }).click();
  await expect(page.getByText('Study request sent.')).toBeVisible();
  await switchTo(page, 'ishaan');
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await page.getByRole('button', { name: 'Accept request' }).click();
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('An eigenvector keeps its direction line.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('An eigenvector keeps its direction line.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm session completion' }).click();
  await expect(page.getByText(/Your completion is recorded/)).toBeVisible();
  await switchTo(page, 'maya');
  await expect(page.getByText('An eigenvector keeps its direction line.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm session completion' }).click();
  await page.getByText('Leave anonymous feedback', { exact: true }).click();
  await page.getByRole('button', { name: 'Submit anonymous feedback' }).click();
  await expect(page.getByText('Your anonymous feedback was submitted.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit anonymous feedback' })).toHaveCount(0);
});
test('anonymous Q&A, study room, and scoped moderator workflow', async ({ page }) => {
  await page.goto('/#/communities?tab=Questions');
  await page.getByRole('button', { name: 'Ask a question' }).click();
  await page.getByLabel('Question title').fill('Why does a negative real part cause decay?');
  await page.locator('.inset-form').getByLabel('Subject', { exact: true }).selectOption('linear');
  await page
    .getByLabel('What have you tried so far?')
    .fill('I looked at the exponential and want to explain the decay.');
  await page.getByRole('button', { name: 'Publish question' }).click();
  await expect(
    page.getByRole('heading', { name: 'Why does a negative real part cause decay?' }),
  ).toBeVisible();
  await expect(page.getByText('Anonymous student', { exact: true })).toBeVisible();
  await switchTo(page, 'ishaan');
  await page
    .getByLabel('Your explanation')
    .fill('A negative exponent gives a factor that shrinks over time.');
  await page.getByRole('button', { name: 'Post explanation' }).click();
  await expect(
    page.getByText('A negative exponent gives a factor that shrinks over time.'),
  ).toBeVisible();
  await switchTo(page, 'maya');
  await page.getByRole('button', { name: 'Accept answer' }).click();
  await expect(page.getByText('Accepted by question author')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('link', { name: 'Study', exact: true })
    .click();
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  await page.getByRole('link', { name: /Linear Algebra Revision Circle/ }).click();
  await page.getByRole('button', { name: 'Mark ready' }).click();
  await page.getByRole('button', { name: 'Start shared timer' }).click();
  await expect(page.getByText('Focus', { exact: true })).toBeVisible();
  await switchTo(page, 'ishaan');
  await expect(page.getByText('Focus', { exact: true })).toBeVisible();
  await switchTo(page, 'maya');
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByLabel('Reason', { exact: true }).fill('Classroom moderation walkthrough.');
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByText('Report sent for review.')).toBeVisible();
  await switchTo(page, 'leena');
  await page.getByRole('link', { name: 'Moderation', exact: true }).click();
  await page.getByText('Harassment · message · pending', { exact: true }).click();
  await page.getByRole('button', { name: 'Open reported item' }).click();
  await expect(page.getByText('That question is stupid. Stop wasting our time.')).toBeVisible();
  await page.getByLabel('Disposition').selectOption('hide');
  await page
    .getByLabel('Reason for the decision')
    .fill('Hide the reported message for the demonstration.');
  await page.getByRole('button', { name: 'Resolve report' }).click();
  await page.getByRole('button', { name: 'Audit log' }).click();
  await expect(page.getByText('Read reported item')).toBeVisible();
  await expect(page.getByText('Resolved report (hide)')).toBeVisible();
});
test('mobile navigation, preferences, planner and quiz use the underlying data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'New study task' }).click();
  await page.getByLabel('Task title').fill('Check the linear systems notes');
  await page.getByRole('button', { name: 'Save study task' }).click();
  await expect(page.getByText('Check the linear systems notes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Quizzes', exact: true }).click();
  await page.getByRole('link', { name: /Eigenvalues practice/ }).click();
  await page.getByLabel('Doubles it', { exact: true }).check();
  await page.getByRole('button', { name: 'Check answers' }).click();
  await expect(page.getByRole('heading', { name: 'Result · 1 / 1' })).toBeVisible();
  await expect(
    page.getByText('An eigenvalue is the scale factor for its corresponding eigenvector.'),
  ).toBeVisible();
});
