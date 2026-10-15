/* Pure selection rules shared by the browser and behavior tests. */
(function (root) {
  const newest = (items) =>
    [...items].sort(
      (a, b) =>
        (b.creationDateDisplayed || "").localeCompare(a.creationDateDisplayed || "") || a.slug.localeCompare(b.slug),
    );
  function select(items, preferences = {}, count = 6) {
    const latest = newest(items).slice(0, 3);
    const excluded = new Set([...latest.map((x) => x.slug), ...(preferences.favorites || [])]);
    const candidates = items.filter((x) => !excluded.has(x.slug));
    const previous = new Set(preferences.previous || []);
    const pool =
      candidates.filter((x) => !previous.has(x.slug)).length >= count
        ? candidates.filter((x) => !previous.has(x.slug))
        : candidates;
    const picks = [],
      families = new Map();
    const score = (x) =>
      (preferences.interests?.[x.displayFamily] || 0) -
      (preferences.seen?.[x.slug] || 0) * 4 -
      (families.get(x.displayFamily) || 0) * 5;
    while (picks.length < count && pool.length) {
      pool.sort(
        (a, b) =>
          score(b) - score(a) ||
          (b.creationDateDisplayed || "").localeCompare(a.creationDateDisplayed || "") ||
          a.slug.localeCompare(b.slug),
      );
      const next = pool.shift();
      picks.push(next);
      families.set(next.displayFamily, (families.get(next.displayFamily) || 0) + 1);
    }
    return { latest, picks };
  }
  root.LIBRARY_DISCOVERY = { newest, select };
})(window);
