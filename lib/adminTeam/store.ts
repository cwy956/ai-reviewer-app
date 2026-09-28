import { getSupabase } from "../db/supabaseClient";
import type { AdminTeamMember } from "./schema";

export async function listAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const { data, error } = await getSupabase()
    .from("admin_team_members")
    .select("id, name, email")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`관리팀 구성원 조회 실패: ${error.message}`);
  return data as AdminTeamMember[];
}

export async function addAdminTeamMember(member: { name: string; email: string }): Promise<AdminTeamMember> {
  const { data, error } = await getSupabase()
    .from("admin_team_members")
    .insert({ name: member.name, email: member.email })
    .select("id, name, email")
    .single();
  if (error) throw new Error(`관리팀 구성원 등록 실패: ${error.message}`);
  return data as AdminTeamMember;
}

export async function removeAdminTeamMember(id: string): Promise<void> {
  const { error } = await getSupabase().from("admin_team_members").delete().eq("id", id);
  if (error) throw new Error(`관리팀 구성원 삭제 실패: ${error.message}`);
}
