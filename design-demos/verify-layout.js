async page => {
  const result = await page.evaluate(() => {
    const interactive = [...document.querySelectorAll("a, button, [role='button']")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    const smallTargets = interactive
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(({ width, height }) => width < 44 || height < 44);
    return {
      viewportWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollX,
      scrollY,
      hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      interactiveCount: interactive.length,
      smallTargets,
      topbar: document.querySelector(".topbar")?.getBoundingClientRect().toJSON(),
      brand: document.querySelector(".brand-lockup")?.getBoundingClientRect().toJSON(),
      uuidVisibleInHtml: document.documentElement.outerHTML.includes("browse-uuid"),
      protectedHref: document.querySelector("a[title='private.txt']")?.getAttribute("href"),
      githubTarget: document.querySelector("a[href='https://github.com/Fiatnorm/R2Gate']")?.target,
    };
  });
  return result;
}
