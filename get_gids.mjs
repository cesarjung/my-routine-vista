async function fetchGids() {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E/edit';
    const res = await fetch(url);
    const text = await res.text();
    const regex = /\["([^"]+)",(\d+),/g;
    let match;
    const gids = {};
    while ((match = regex.exec(text)) !== null) {
      gids[match[1]] = match[2];
    }
    console.log("Found GIDs:", gids);
  } catch (err) {
    console.error(err);
  }
}
fetchGids();
