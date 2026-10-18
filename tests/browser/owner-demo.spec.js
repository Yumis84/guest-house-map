import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('https://unpkg.com/**',route=>route.abort());
 await page.route('https://*.tile.openstreetmap.org/**',route=>route.abort());
 await page.goto('/owner-demo.html');
});

test('autosaves a draft and restores the current step',async({page})=>{
 await page.locator('#demoName').fill('Автосохранённый дом');
 await expect(page.locator('#demoHint')).toContainText('автоматически сохранён');
 await page.locator('#demoNext').click();
 await page.reload();
 await expect(page.locator('#demoName')).toHaveValue('Автосохранённый дом');
 await expect(page.locator('#demoProgress')).toHaveText('Шаг 2 из 5');
});

test('blocks invalid steps and previews nightly terms with availability closed by default',async({page})=>{
 await page.locator('#demoName').fill('   ');
 await page.locator('#demoNext').click();
 await expect(page.locator('#demoProgress')).toHaveText('Шаг 1 из 5');
 await expect(page.locator('#demoValidation')).toContainText('Укажите название');
 await page.locator('#demoName').fill('Дом у леса');
 await page.locator('#demoNext').click();
 await expect(page.locator('#demoAvailable')).not.toBeChecked();
 await page.locator('#demoPrice').fill('5600');
 await page.locator('#demoMinNights').fill('3');
 await page.locator('#demoNext').click();await page.locator('#demoNext').click();await page.locator('#demoNext').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Опубликовать'}).click();
 await expect(page.locator('#demoGuest')).toContainText('5 600 ₽ за ночь · минимум 3 ночи · доступность закрыта');
});

test('validates, compresses, persists and removes photos',async({page})=>{
 await page.locator('#demoNext').click();await page.locator('#demoNext').click();await page.locator('#demoNext').click();
 await page.locator('#demoPhotos').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await expect(page.locator('#demoPhotoStatus')).toContainText('Не добавлено: 1');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrQAAAABJRU5ErkJggg==','base64');
 await page.locator('#demoPhotos').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#demoPhotoGrid img')).toHaveCount(1);
 await expect(page.locator('#demoPhotoGrid img')).toHaveAttribute('src',/^data:image\/webp/);
 await page.reload();
 await expect(page.locator('#demoPhotoGrid img')).toHaveCount(1);
 await page.getByRole('button',{name:'Удалить фото'}).click();
 await expect(page.locator('#demoPhotoGrid img')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('#demoPhotoGrid img')).toHaveCount(0);
});
