// Mutation check: disable each guard in turn, confirm the suite catches it.
const fs = require('fs');
const src = fs.readFileSync('test.js','utf8');
const MUT = process.env.MUT;
const mutations = {
  overdraft: `drop trigger ledger_postings_no_overdraft on public.ledger_postings;`,
  balanced:  `drop trigger ledger_postings_balanced on public.ledger_postings;`,
  fundmatch: `drop trigger ledger_postings_funding_matches_invoice on public.ledger_postings;`,
  immutable: `drop trigger ledger_postings_immutable on public.ledger_postings;`,
  modeguard: `drop trigger strike_invoice_polls_mode_guard on public.strike_invoice_polls;`,
};
const patched = src.replace(
  "    check('schema applies cleanly', true);",
  `    check('schema applies cleanly', true);
    await client.query(${JSON.stringify(mutations[MUT])});
    console.log('  !! MUTATION ACTIVE: ${MUT}');`
).replace('const PORT = 55433;', 'const PORT = 55500;');
fs.writeFileSync('test.mut.js', patched);
