const PouchDB = require('pouchdb')
const express = require('express')
const cors = require('cors')
const next = require('next')
const endsWith = require('lodash.endswith')
const basicAuthHeader = require('basic-authorization-header')

const {
  PORT,
  DEBUG,
  NODE_ENV,
  COUCHDB_URL,
  COUCHDB_USERNAME,
  COUCHDB_PASSWORD
} = process.env

const port = parseInt(PORT, 10) || 3001
const dev = (NODE_ENV !== 'production')
const app = next({ dev })
const handle = app.getRequestHandler()

let ActualDb

if (dev) {
  console.log('Using in-memory db')

  ActualDb = PouchDB.defaults({
    db: require('memdown')
  })
} else {
  if (!COUCHDB_URL || !COUCHDB_USERNAME || !COUCHDB_PASSWORD) {
    throw new Error("COUCHDB_ env vars must be set!")
  }

  console.log(`Using HTTP proxy db (${COUCHDB_URL})`)

  const url = endsWith(COUCHDB_URL, '/') ? COUCHDB_URL : `${COUCHDB_URL}/`

  ActualDb = require('./http-pouchdb')(PouchDB, url, {
    auth: {
      username: COUCHDB_USERNAME,
      password: COUCHDB_PASSWORD
    }
  })
}


app.prepare()
  .then(() => {
    const server = express()

    server.use(cors({
      origin: true,
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 200
    }))

    server.use('/db', require('express-pouchdb')(ActualDb, {
      logPath: '/tmp/meth-express-pouchdb.log',
      inMemoryConfig: true,
      mode: 'minimumForPouchDB',
      overrideMode: {
        include: (DEBUG ? [
          'config-infrastructure',
          'logging-infrastructure',
          'routes/http-log'
        ] : [])
      }
    }))

    server.get('*', (req, res) => {
      return handle(req, res)
    })

    server.listen(port, (err) => {
      if (err) throw err
      console.log(`> Ready on http://localhost:${port}`)
    })
  })
