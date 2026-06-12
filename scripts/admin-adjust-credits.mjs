#!/usr/bin/env node

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) {
      index += 1;
    }
    args.set(rawKey, value ?? "");
  }

  const email = String(args.get("email") ?? "").trim().toLowerCase();
  const amount = Number(args.get("amount"));
  const reason =
    String(args.get("reason") ?? "").trim() ||
    `local email credit adjustment ${new Date().toISOString()}`;

  return {
    email,
    amount,
    reason,
    adminEmail: String(
      args.get("admin-email") ??
        process.env.ADMIN_CREDIT_ADJUST_ACTOR_EMAIL ??
        "local-admin@localhost",
    ).trim(),
    idempotencyKey: String(args.get("idempotency-key") ?? "").trim(),
    json: args.has("json"),
  };
}

function validateInput(input) {
  if (!input.email || !input.email.includes("@")) {
    throw new Error("--email must be a valid email.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("--amount must be a positive integer.");
  }
  if (input.reason.length < 6) {
    throw new Error("--reason must be at least 6 characters.");
  }
}

async function adjustCredits({ sql, input }) {
  const idempotencyKey =
    input.idempotencyKey ||
    `admin_adjust:email:${input.email}:${randomUUID()}`;

  const [result] = await sql`
    with target_user as (
      select id, email
      from users
      where lower(email) = ${input.email}
      limit 2
    ),
    user_count as (
      select count(*)::int as count from target_user
    ),
    existing_ledger as (
      select
        cl.id,
        cl.user_id,
        cl.wallet_id,
        cl.type,
        cl.amount,
        cl.balance_before,
        cl.balance_after,
        cl.reserved_before,
        cl.reserved_after,
        cl.reason,
        cl.idempotency_key,
        cw.available_balance,
        cw.reserved_balance
      from credit_ledger cl
      join credit_wallets cw on cw.user_id = cl.user_id
      where cl.idempotency_key = ${idempotencyKey}
      limit 1
    ),
    inserted_wallet as (
      insert into credit_wallets (user_id)
      select tu.id
      from target_user tu
      cross join user_count uc
      where uc.count = 1
        and not exists (
          select 1 from credit_wallets where user_id = tu.id
        )
      returning *
    ),
    current_wallet as (
      select cw.*
      from credit_wallets cw
      join target_user tu on tu.id = cw.user_id
      cross join user_count uc
      where uc.count = 1
      limit 1
    ),
    wallet_source as (
      select * from current_wallet
      union all
      select * from inserted_wallet
      limit 1
    ),
    updated_wallet as (
      update credit_wallets
      set
        available_balance = ws.available_balance + ${input.amount},
        updated_at = now()
      from wallet_source ws
      where credit_wallets.id = ws.id
        and (select count from user_count) = 1
        and not exists (select 1 from existing_ledger)
      returning credit_wallets.*
    ),
    inserted_ledger as (
      insert into credit_ledger (
        user_id,
        wallet_id,
        type,
        amount,
        balance_before,
        balance_after,
        reserved_before,
        reserved_after,
        reason,
        idempotency_key,
        metadata
      )
      select
        tu.id,
        ws.id,
        'admin_adjust',
        ${input.amount},
        ws.available_balance,
        uw.available_balance,
        ws.reserved_balance,
        uw.reserved_balance,
        ${input.reason},
        ${idempotencyKey},
        jsonb_build_object(
          'actorEmail', ${input.adminEmail}::text,
          'targetEmail', tu.email,
          'source', 'scripts/admin-adjust-credits.mjs'
        )
      from target_user tu
      join wallet_source ws on ws.user_id = tu.id
      join updated_wallet uw on uw.user_id = tu.id
      where not exists (select 1 from existing_ledger)
      returning *
    ),
    inserted_audit as (
      insert into admin_audit_logs (
        admin_user_id,
        actor_email,
        action,
        target_type,
        target_id,
        reason,
        before_snapshot,
        after_snapshot,
        user_agent
      )
      select
        null,
        ${input.adminEmail},
        'credits:admin_adjust',
        'user',
        null,
        ${input.reason},
        jsonb_build_object(
          'email', tu.email,
          'balanceBefore', il.balance_before,
          'reservedBefore', il.reserved_before
        ),
        jsonb_build_object(
          'email', tu.email,
          'ledgerId', il.id,
          'amount', il.amount,
          'balanceAfter', il.balance_after,
          'reservedAfter', il.reserved_after
        ),
        'scripts/admin-adjust-credits.mjs'
      from inserted_ledger il
      join target_user tu on tu.id = il.user_id
      returning *
    )
    select
      (select count from user_count) as user_count,
      false as idempotent,
      tu.id as user_id,
      tu.email,
      il.id as ledger_id,
      il.type,
      il.amount,
      il.balance_before,
      il.balance_after,
      il.reserved_before,
      il.reserved_after,
      il.reason,
      il.idempotency_key,
      uw.id as wallet_id,
      uw.available_balance,
      uw.reserved_balance,
      ia.id as audit_id
    from inserted_ledger il
    join target_user tu on tu.id = il.user_id
    join updated_wallet uw on uw.user_id = il.user_id
    left join inserted_audit ia on true
    union all
    select
      (select count from user_count) as user_count,
      true as idempotent,
      el.user_id,
      (select email from target_user limit 1) as email,
      el.id as ledger_id,
      el.type,
      el.amount,
      el.balance_before,
      el.balance_after,
      el.reserved_before,
      el.reserved_after,
      el.reason,
      el.idempotency_key,
      el.wallet_id,
      el.available_balance,
      el.reserved_balance,
      null as audit_id
    from existing_ledger el
    union all
    select
      (select count from user_count) as user_count,
      false as idempotent,
      null as user_id,
      null as email,
      null as ledger_id,
      null as type,
      null as amount,
      null as balance_before,
      null as balance_after,
      null as reserved_before,
      null as reserved_after,
      null as reason,
      null as idempotency_key,
      null as wallet_id,
      null as available_balance,
      null as reserved_balance,
      null as audit_id
    where (select count from user_count) <> 1
    limit 1
  `;

  if (!result) {
    throw new Error("Credit adjustment failed.");
  }
  if (Number(result.user_count) === 0) {
    throw new Error(`No user found for email ${input.email}.`);
  }
  if (Number(result.user_count) > 1) {
    throw new Error(`Multiple users found for email ${input.email}.`);
  }
  if (!result.ledger_id) {
    throw new Error("Credit adjustment did not create or find a ledger entry.");
  }

  return result;
}

function printResult(result, json) {
  const payload = {
    idempotent: Boolean(result.idempotent),
    user: {
      id: result.user_id,
      email: result.email,
    },
    ledger: {
      id: result.ledger_id,
      type: result.type,
      amount: Number(result.amount),
      balanceBefore: Number(result.balance_before),
      balanceAfter: Number(result.balance_after),
      reservedBefore: Number(result.reserved_before),
      reservedAfter: Number(result.reserved_after),
      reason: result.reason,
      idempotencyKey: result.idempotency_key,
    },
    wallet: {
      id: result.wallet_id,
      availableBalance: Number(result.available_balance),
      reservedBalance: Number(result.reserved_balance),
    },
    auditId: result.audit_id,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    [
      `Adjusted credits for ${payload.user.email} (${payload.user.id})`,
      `Amount: ${payload.ledger.amount}`,
      `Balance: ${payload.ledger.balanceBefore} -> ${payload.ledger.balanceAfter}`,
      `Reserved: ${payload.ledger.reservedBefore} -> ${payload.ledger.reservedAfter}`,
      `Ledger: ${payload.ledger.id}`,
      `Audit: ${payload.auditId ?? "(idempotent replay, audit not duplicated)"}`,
      `Idempotent: ${payload.idempotent}`,
    ].join("\n"),
  );
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  validateInput(input);
  const sql = neon(readEnv("DATABASE_URL"));
  const result = await adjustCredits({ sql, input });
  printResult(result, input.json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
