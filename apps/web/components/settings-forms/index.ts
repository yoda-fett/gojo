// Story 12.3 + 12.4 — shared Settings form barrel.
//
// The wizard step integration embeds the same form bodies the /settings/*
// pages render. Re-exporting through this barrel formalises the contract:
//   - Settings pages and wizard steps must both import from here.
//   - Each form component must stay chrome-less (no rail / topbar) so it
//     drops into either context.
//
// NOTE (hotfix backlog): the wireframes specify a Topbar on each Settings
// page. The current per-screen `<Topbar>` integration was missed in 12.7b–e
// and is tracked as a follow-up; the wizard never wants a Topbar regardless,
// so the fix lives in the /settings/* RSCs, not in these form components.

// Foundational steps (1–4) — wired by Story 12.3.
export { PropertyProfileClient as PropertyProfileForm } from '@/app/(app)/settings/property-profile/_components/property-profile-client';
export { RoomTypesClient as RoomTypesForm } from '@/app/(app)/settings/room-types/_components/room-types-client';
export { RoomsClient as RoomsForm } from '@/app/(app)/settings/rooms/_components/rooms-client';
export { UsersRolesClient as UsersRolesForm } from '@/app/(app)/settings/users-roles/_components/users-roles-client';

// Operational steps (5–7) — wired by Story 12.4.
export { RateManagementClient as RateManagementForm } from '@/app/(app)/settings/rate-plans/_components/rate-management-client';
export { CatalogClient as HousekeepingCatalogForm } from '@/components/catalog/catalog-client';
export { DirectBookingSettingsForm } from '@/app/(app)/settings/direct-booking/form';
