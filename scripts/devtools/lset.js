(async () => {
  const m = await import('/junyoung-voca/src/lib/settings.ts');
  await m.saveSettings(__ARGS__);
  return 'saved ' + location.hash;
})()
