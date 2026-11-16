"""Shared entry flow for local browser acceptance scripts."""
def choose_loadout(page):
    page.get_by_role('button', name='Weiter zur Waffenauswahl', exact=True).click()
    start = page.get_by_role('button', name='Mit diesen 5 Waffen starten', exact=False)
    if start.is_disabled():
        for name in ['Karabiner 98k', 'Luger P08', 'MP 40', 'StG 44', 'Gewehr 43']:
            page.locator('.weapon-catalog button').filter(has=page.get_by_text(name, exact=True)).click()
    start.click()
