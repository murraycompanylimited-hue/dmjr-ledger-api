
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const LEDGER_PATH = process.env.LEDGER_PATH || "./data/ledger.json";
const API_KEY = process.env.API_KEY || ""; // optional day-1 gate

const read = () => JSON.parse(fs.readFileSync(LEDGER_PATH, "utf-8"));
const write = (d) => fs.writeFileSync(LEDGER_PATH, JSON.stringify(d, null, 2));
const find = (L, id) => L.accounts.find(a => a.id === id);

// optional simple auth
app.use((req, res, next) => {
  if (!API_KEY) return next();
  if (req.get("x-dmjr-key") !== API_KEY) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.get("/api/health", (req,res)=> res.json({ ok:true, service:"dmjr-ledger-api" }));

app.get("/api/balance/:id", (req,res)=>{
  const L = read(); const a = find(L, req.params.id);
  if(!a) return res.status(404).json({ error:"account_not_found" });
  res.json({ accountId: a.id, balance_mg: a.balance_mg });
});

app.post("/api/issue", (req,res)=>{
  const { to, amount_mg, memo } = req.body || {};
  if(!to || !Number.isInteger(amount_mg) || amount_mg <= 0) return res.status(400).json({ error:"invalid_params" });
  const L = read(); const dest = find(L, to);
  if(!dest) return res.status(404).json({ error:"dest_not_found" });
  dest.balance_mg += amount_mg;
  const tx = { txid: nanoid(), timestamp: new Date().toISOString(), type: "ISSUANCE", from: null, to, amount_mg, memo: memo || "" };
  L.transactions.push(tx); write(L); res.json(tx);
});

app.post("/api/transfer", (req,res)=>{
  const { from, to, amount_mg, memo } = req.body || {};
  if(!from || !to || !Number.isInteger(amount_mg) || amount_mg <= 0) return res.status(400).json({ error:"invalid_params" });
  const L = read(); const A = find(L, from), B = find(L, to);
  if(!A || !B) return res.status(404).json({ error:"account_not_found" });
  if(A.balance_mg < amount_mg) return res.status(400).json({ error:"insufficient_funds" });
  A.balance_mg -= amount_mg; B.balance_mg += amount_mg;
  const tx = { txid: nanoid(), timestamp: new Date().toISOString(), type: "TRANSFER", from, to, amount_mg, memo: memo || "" };
  L.transactions.push(tx); write(L); res.json(tx);
});

app.get("/api/accounts", (req,res)=> res.json(read().accounts));
app.get("/api/transactions", (req,res)=> res.json(read().transactions.slice(-200)));

const port = process.env.PORT || 8080;
app.listen(port, ()=> console.log(`dmjr-ledger-api :${port}`));
