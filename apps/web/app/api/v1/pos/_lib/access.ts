// The POS gate lives with the other staff gates so every route uses one implementation.
export {
  requirePosAccess,
  requirePosPermission,
  type StaffResult as PosAccessResult,
  type StaffContext,
  type StaffPermissions,
} from "../../_lib/staff-access";
