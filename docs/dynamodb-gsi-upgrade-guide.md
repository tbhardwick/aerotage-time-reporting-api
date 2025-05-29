# Handling DynamoDB "One GSI Operation at a Time" Errors During CDK Deployments

## Background
AWS DynamoDB only allows **one** Global Secondary Index (GSI) _create_, _delete_, or _update_ operation **per table at a time**. When a CloudFormation or CDK deployment attempts to perform multiple GSI mutations on the same existing table in a single change-set, the deployment fails with an error similar to:

```text
Resource handler returned message: "One or more parameter values were invalid: \nNumber of simultaneous GSI operations exceeds limit of 1"
```

In our `DatabaseStack`, several tables that already exist in the **dev/staging/prod** environments recently received multiple new `addGlobalSecondaryIndex` calls. Because all of these changes are bundled into one deploy, CloudFormation schedules more than one GSI operation per table and the stack rolls back.

## Tables Affected in the Current Change-Set
| Table | Planned GSI Operations |
|-------|------------------------|
| `TimeEntriesTable` | + `ProjectIndex`, + `StatusIndex`, + `ApprovalIndex` |
| `InvoicesTable` | + `StatusIndex`, + `InvoiceNumberIndex` |
| `UserInvitationsTable` | − `TokenHashIndex` (delete) <br> + `TokenHashIndexV2` (create) |
| _(others may be added later)_ | |

## Resolution Strategies

### 1. **Dev-Only Quick Fix – Destroy & Re-Deploy**
If you only care about the **dev** environment and can lose all data:

```bash
npm run destroy:dev   # removes the whole dev stack (tables use RemovalPolicy.DESTROY)
npm run deploy:dev    # fresh deploy – tables are recreated with all GSIs in place
```

### 2. **Production-Safe Fix – Deploy in Phases (Recommended)**
Break the update into several deployments, ensuring each table undergoes **one** GSI change per deploy.

1. Choose an environment variable (e.g. `GSI_PHASE`).
2. Wrap each `addGlobalSecondaryIndex` block in a phase check:

```typescript
// TimeEntriesTable example
const phase = process.env.GSI_PHASE ?? '1';

if (phase === '1') {
  timeEntriesTable.addGlobalSecondaryIndex({
    indexName: 'ProjectIndex',
    partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
    sortKey:      { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
  });
}

if (phase === '2') {
  timeEntriesTable.addGlobalSecondaryIndex({
    indexName: 'StatusIndex',
    partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
    sortKey:      { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
  });
}
```

3. Deploy sequentially, waiting for each new index to reach `ACTIVE` before the next pass:

```bash
GSI_PHASE=1 npm run deploy:staging
# wait until indexes are ACTIVE
GSI_PHASE=2 npm run deploy:staging
```

4. Repeat for every table needing multiple index changes.

### 3. **One-Off Hot-Fix – Comment Out Extra GSIs**
Temporarily comment out additional `addGlobalSecondaryIndex` calls so each existing table receives at most **one** new GSI. Deploy, wait for the index to become `ACTIVE`, then uncomment the next batch and deploy again.

## Checklist Before Each Deploy
- [ ] Confirm which GSIs already exist using AWS Console or:
  ```bash
  aws dynamodb describe-table --table-name <TABLE>
  ```
- [ ] Ensure the change-set includes **≤ 1** GSI operation per existing table.
- [ ] If replacing an old index (delete + create), split it into two separate deploys: _add_ the new index first, then _remove_ the old one in a later deploy.

## Take-Away
CloudFormation can create many GSIs **when the table is new**, but for **updates to an existing table** it must respect DynamoDB's "one GSI operation at a time" rule. Staging the changes (or recreating dev tables) guarantees a successful deploy. 