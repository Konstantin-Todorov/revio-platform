import { forSystem, forTenant } from "./rls.js";
import type { TwoFactorStore } from "./two-factor.js";

/**
 * The two tables `two-factor.ts` can drive.
 *
 * Everything security-significant lives in that module; these are only the queries. Keeping them
 * apart is what let the operator implementation become the hotel one without either being rewritten.
 */

/**
 * Operator accounts — the console that reads every hotel's data.
 *
 * System perimeter, because `OperatorUser` is `operator_only` by policy and there is no tenant to
 * scope to. This is one of the few paths `forSystem()` exists for.
 */
export function operatorTwoFactorStore(): TwoFactorStore {
  const db = forSystem();
  return {
    async read(id) {
      return db.operatorUser.findUnique({
        where: { id },
        select: { email: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true },
      });
    },
    async write(id, data) {
      await db.operatorUser.update({ where: { id }, data });
    },
    async listRecoveryCodes(id) {
      return db.operatorRecoveryCode.findMany({
        where: { operatorUserId: id },
        select: { id: true, codeHash: true, usedAt: true },
      });
    },
    async replaceRecoveryCodes(id, hashes) {
      await db.operatorRecoveryCode.deleteMany({ where: { operatorUserId: id } });
      if (hashes.length > 0) {
        await db.operatorRecoveryCode.createMany({
          data: hashes.map((codeHash) => ({ operatorUserId: id, codeHash })),
        });
      }
    },
    async markRecoveryCodeUsed(codeId, at) {
      await db.operatorRecoveryCode.update({ where: { id: codeId }, data: { usedAt: at } });
    },
    async countUnusedRecoveryCodes(id) {
      return db.operatorRecoveryCode.count({ where: { operatorUserId: id, usedAt: null } });
    },
  };
}

/**
 * Hotel staff accounts — one shared identity across RevioLink, RevioCRS and RevioPMS.
 *
 * ⚠️ **System perimeter, deliberately, and this is the one decision here worth defending.** Sign-in
 * happens BEFORE any tenant context exists: the whole point of the step is to work out who this is,
 * so there is no `tenantId` to scope by and `forTenant()` cannot be used. Reading a `totpSecret` by
 * primary key on a path that has already proved the password is the narrowest thing that works.
 *
 * `forTenantUser` below is the other half: once a session DOES exist — enrolling, disabling,
 * regenerating codes — the tenant is known and the tenant perimeter is used, so a hotel can only
 * ever touch its own people. Sign-in is the exception; account management is not.
 */
export function userTwoFactorStore(): TwoFactorStore {
  const db = forSystem();
  return {
    async read(id) {
      return db.user.findUnique({
        where: { id },
        select: { email: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true },
      });
    },
    async write(id, data) {
      await db.user.update({ where: { id }, data });
    },
    async listRecoveryCodes(id) {
      return db.userRecoveryCode.findMany({
        where: { userId: id },
        select: { id: true, codeHash: true, usedAt: true },
      });
    },
    async replaceRecoveryCodes(id, hashes) {
      await db.userRecoveryCode.deleteMany({ where: { userId: id } });
      if (hashes.length > 0) {
        await db.userRecoveryCode.createMany({
          data: hashes.map((codeHash) => ({ userId: id, codeHash })),
        });
      }
    },
    async markRecoveryCodeUsed(codeId, at) {
      await db.userRecoveryCode.update({ where: { id: codeId }, data: { usedAt: at } });
    },
    async countUnusedRecoveryCodes(id) {
      return db.userRecoveryCode.count({ where: { userId: id, usedAt: null } });
    },
  };
}

/**
 * The same store, scoped to one hotel — for everything a signed-in person does to their own account.
 *
 * The RLS policy on `UserRecoveryCode` resolves the tenant through the `User` row rather than a
 * duplicated column, so a code cannot disagree with its owner about who it belongs to.
 */
export function tenantUserTwoFactorStore(tenantId: string): TwoFactorStore {
  const db = forTenant(tenantId);
  return {
    async read(id) {
      return db.user.findFirst({
        where: { id, tenantId },
        select: { email: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true },
      });
    },
    async write(id, data) {
      // updateMany, not update: `update` targets a primary key and would reach outside the tenant
      // if the id were ever wrong. The policy would refuse it, and failing on our side first says
      // something clearer than a database error.
      await db.user.updateMany({ where: { id, tenantId }, data });
    },
    async listRecoveryCodes(id) {
      return db.userRecoveryCode.findMany({
        where: { userId: id },
        select: { id: true, codeHash: true, usedAt: true },
      });
    },
    async replaceRecoveryCodes(id, hashes) {
      await db.userRecoveryCode.deleteMany({ where: { userId: id } });
      if (hashes.length > 0) {
        await db.userRecoveryCode.createMany({
          data: hashes.map((codeHash) => ({ userId: id, codeHash })),
        });
      }
    },
    async markRecoveryCodeUsed(codeId, at) {
      await db.userRecoveryCode.update({ where: { id: codeId }, data: { usedAt: at } });
    },
    async countUnusedRecoveryCodes(id) {
      return db.userRecoveryCode.count({ where: { userId: id, usedAt: null } });
    },
  };
}
