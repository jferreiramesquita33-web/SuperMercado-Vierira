require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { createClient } = require("@supabase/supabase-js");

console.log("URL:", process.env.SUPABASE_URL);
console.log("KEY existe:", !!process.env.SUPABASE_KEY);
console.log(
  "KEY começa com:",
  process.env.SUPABASE_KEY
    ? process.env.SUPABASE_KEY.substring(0, 15)
    : "NÃO ENCONTRADA"
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

console.log("Supabase conectado!");

module.exports = supabase;