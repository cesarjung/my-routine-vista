const API_URL = 'https://script.google.com/macros/s/AKfycbxn-YpuZZsNsdGT_FxQdhUwLE5KUIuXvo7Ffad03x80LByig3qneNe7-hy9PUZYS8-bDg/exec';
const SECRET_TOKEN = 'sirtec_vista_2026_seguro';
const unidadeId = '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E';

async function testFetch() {
  console.log("Starting fetch...");
  const startTime = Date.now();
  try {
    const url = `${API_URL}?token=${SECRET_TOKEN}&id=${unidadeId}&sheets=Carteira_Planejador,Plan_Principal,BD_Metas,Reprogramadas,Base_Curva,BD_Config`;
    const res = await fetch(url);
    console.log(`Fetch completed in ${Date.now() - startTime}ms. Status:`, res.status);
    const text = await res.text();
    console.log("Response length:", text.length);
    console.log("Response text start:", text.substring(0, 150));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
