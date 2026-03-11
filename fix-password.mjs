// fix-password.mjs
// 运行: node fix-password.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')
const { Client } = require('pg')

const PASSWORD = 'admin123'
const PHONE    = '+19783300895'
const DB_URL   = 'postgresql://carnation:carnation123@localhost:5432/carnation_spa'

const hash = bcrypt.hashSync(PASSWORD, 10)
console.log('Generated hash:', hash)

const client = new Client({ connectionString: DB_URL })
await client.connect()

const res = await client.query(
  `UPDATE "Account" SET "passwordHash" = $1 WHERE phone = $2 RETURNING phone, name`,
  [hash, PHONE]
)

if (res.rowCount > 0) {
  console.log('✅ Password updated for:', res.rows[0].name)
  console.log('   Login with:', PHONE, '/', PASSWORD)
} else {
  console.log('❌ Account not found:', PHONE)
}

await client.end()
