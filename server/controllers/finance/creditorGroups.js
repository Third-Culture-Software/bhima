/**
 * @overview CreditorGroups
 *
 * @description
 * This controller exposes an API to the client for reading and creditor_groups
 */
const { uuid } = require('../../lib/util');
const db = require('../../lib/db');
const BadRequest = require('../../lib/errors/BadRequest');

// GET /creditor_groups
function lookupCreditorGroup(Uuid) {
  const sql = `
    SELECT enterprise_id, BUID(uuid) as uuid, name, account_id, locked
    FROM creditor_group
    WHERE creditor_group.uuid = ?;
  `;

  return db.one(sql, [db.bid(Uuid)], Uuid, 'Creditor Group');
}

// Lists of Creditor Groups
function list(req, res, next) {
  let sql = 'SELECT BUID(uuid) as uuid, name FROM creditor_group ;';

  if (req.query.detailed === '1') {
    sql = `
      SELECT creditor_group.enterprise_id, BUID(creditor_group.uuid) AS uuid, creditor_group.name,
        creditor_group.account_id, creditor_group.locked,
        COUNT(creditor.uuid) AS total_creditors, account.number
      FROM creditor_group
      JOIN account ON account.id = creditor_group.account_id
      LEFT JOIN creditor ON creditor.group_uuid = creditor_group.uuid
      GROUP BY creditor_group.uuid`;
  }

  db.exec(sql)
    .then((rows) => {
      res.status(200).json(rows);
    })
    .catch(next);

}

/**
* GET /creditor_groups/:uuid
*
* Returns the detail of a single Creditor Group
*/
function detail(req, res, next) {
  lookupCreditorGroup(req.params.uuid)
    .then((record) => {
      res.status(200).json(record);
    })
    .catch(next);

}

/**
* POST /creditor_groups
*
* Insert new records in the creditor_group table
*/
function create(req, res, next) {
  const data = req.body;

  // provide UUID if the client has not specified
  const creditorGroupUuid = data.uuid || uuid();
  data.uuid = db.bid(creditorGroupUuid);
  data.enterprise_id = req.session.enterprise.id;

  const sql = 'INSERT INTO creditor_group SET ? ';

  db.exec(sql, [data])
    .then(() => {
      res.status(201).json({ uuid : creditorGroupUuid });
    })
    .catch(next);

}

/**
* PUT /creditor_groups/:uuid
*
* Update a creditor group based on its uuid
*/
function update(req, res, next) {
  const sql = 'UPDATE creditor_group SET ? WHERE uuid = ?;';

  const uid = db.bid(req.params.uuid);

  db.exec(sql, [req.body, uid])
    .then(() => {
      return lookupCreditorGroup(req.params.uuid);
    })
    .then((record) => {
      res.status(200).json(record);
    })
    .catch(next);

}

/**
* DELETE /creditor_groups/:uuid
*
* Delete an existing creditor group
*/
function remove(req, res, next) {
  const sql = 'DELETE FROM creditor_group WHERE uuid = ?;';
  const uid = db.bid(req.params.uuid);
  db.exec(sql, [uid])
    .then(rows => {
      if (!rows.affectedRows) {
        throw new BadRequest(
          `Cannot delete the creditor group with id ${req.params.uuid}`,
          'CREDITOR_GROUP.FAILURE_DELETE',
        );
      }
      res.sendStatus(203);
    })
    .catch(next);

}

// get list of creditor group
exports.list = list;

// get details of a creditor group
exports.detail = detail;

// create a new creditor group
exports.create = create;

// update creditor group informations
exports.update = update;

// delete the group
exports.remove = remove;
