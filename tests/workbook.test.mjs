import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.JSZip = (await import('../assets/jszip.min.js')).default;
await import('../assets/t4-workbook.js');

test('leitor preserva colunas depois de uma célula OOXML vazia', async () => {
  const zip = new globalThis.JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Teste" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>antes</t></is></c><c r="B1"/><c r="C1" t="inlineStr"><is><t>depois</t></is></c><c r="D1" t="inlineStr"><is><t>final</t></is></c></row></sheetData></worksheet>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const workbook = await globalThis.T4Workbook.read({ arrayBuffer: async () => buffer });
  assert.deepEqual(workbook.sheets[0].rows[0], ['antes', '', 'depois', 'final']);
});

test('célula de data nativa do Excel (número de série) é convertida para ISO, não perdida como número solto', async () => {
  const zip = new globalThis.JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Teste" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  // numFmtId 14 é o formato de data curta embutido do OOXML (ECMA-376 §18.8.30);
  // cellXfs[1] referencia esse formato. A célula A1 usa s="1" (estilo de data) e
  // A2 usa s="0" (Geral) para provar que só a célula formatada como data é convertida.
  zip.file('xl/styles.xml', '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>');
  // 25569 = número de dias entre a âncora do Excel (30/12/1899) e 01/01/1970,
  // a constante clássica de conversão Excel↔Unix — serve de referência externa
  // independente da fórmula usada pela implementação.
  zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" s="1"><v>25569</v></c><c r="B1" s="1"><v>25569.5</v></c><c r="C1" s="0"><v>25569</v></c></row></sheetData></worksheet>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const workbook = await globalThis.T4Workbook.read({ arrayBuffer: async () => buffer });
  assert.equal(workbook.sheets[0].rows[0][0], '1970-01-01');
  assert.equal(workbook.sheets[0].rows[0][1], '1970-01-01T12:00:00');
  assert.equal(workbook.sheets[0].rows[0][2], 25569, 'célula sem formato de data deve continuar sendo o número puro');
});

test('célula de fórmula com resultado texto (t="str") lê só <v>, não concatena o texto da fórmula', async () => {
  // Reproduz exatamente a estrutura encontrada na aba "Nectanet Partner" da
  // planilha oficial Mapeamento candidatos - Nectanet.xlsm: uma fórmula
  // TEXTJOIN/FILTER exportada do Google Sheets como __xludf.DUMMYFUNCTION,
  // com <f> (texto da fórmula) e <v> (valor calculado) como irmãos dentro de <c>.
  const zip = new globalThis.JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Teste" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  const formula = 'IFERROR(__xludf.DUMMYFUNCTION(&quot;IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(...)),&quot;&quot;&quot;&quot;)&quot;),&quot;Jean Carlos&#10;Carla Alessandra&quot;)';
  zip.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="str"><f>${formula}</f><v>Jean Carlos&#10;Carla Alessandra</v></c></row></sheetData></worksheet>`);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const workbook = await globalThis.T4Workbook.read({ arrayBuffer: async () => buffer });
  assert.equal(workbook.sheets[0].rows[0][0], 'Jean Carlos\nCarla Alessandra', 'deve ler somente o conteúdo de <v>, sem nenhum fragmento do texto da fórmula em <f>');
});
