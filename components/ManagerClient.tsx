'use client';

import { useState, useTransition, type FormEvent } from 'react';
import {
  Target,
  Users,
  Edit2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  Mail,
  Clock,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  updateMemberKpi,
  updateTeamSettings,
  setUserStatus,
  setUserRole,
  inviteMember,
  cancelInvitation,
} from '@/lib/actions';
import { formatCurrency } from '@/lib/utils';
import type {
  Profile,
  CalculatedMember,
  TeamSettings,
  MemberInvitation,
} from '@/lib/types';

export default function ManagerClient({
  currentUser,
  members,
  invitations,
  teamSettings,
}: {
  currentUser: Profile;
  members: CalculatedMember[];
  invitations: MemberInvitation[];
  teamSettings: TeamSettings;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [editTeam, setEditTeam] = useState<TeamSettings | null>(null);
  const [editMember, setEditMember] = useState<CalculatedMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    target_sales: 10000000,
    conversion_rate: 10,
    lead_time: 7,
  });

  const activeManagerCount = members.filter(
    (m) => m.role === 'MANAGER' && m.status === 'ACTIVE'
  ).length;

  const handleSaveTeam = (e: FormEvent) => {
    e.preventDefault();
    if (!editTeam) return;
    const patch = {
      target_sales: editTeam.target_sales,
      avg_deal_size: editTeam.avg_deal_size,
      conversion_rate: editTeam.conversion_rate,
      lead_time: editTeam.lead_time,
    };
    setEditTeam(null);
    startTransition(async () => {
      const res = await updateTeamSettings(patch);
      if (res.error) showToast(`저장 실패: ${res.error}`);
      else showToast('팀 전체 KPI가 수정되었습니다.');
    });
  };

  const handleSaveMember = (e: FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    const patch = {
      name: editMember.name,
      target_sales: editMember.target_sales,
      current_sales: editMember.current_sales,
      conversion_rate: editMember.conversion_rate,
      lead_time: editMember.lead_time,
      license_type: editMember.license_type ?? '',
      license_number: editMember.license_number ?? '',
      license_expiry: editMember.license_expiry ?? null,
      hire_date: editMember.hire_date ?? null,
      phone: editMember.phone ?? '',
    };
    const id = editMember.id;
    setEditMember(null);
    startTransition(async () => {
      const res = await updateMemberKpi(id, patch);
      if (res.error) showToast(`저장 실패: ${res.error}`);
      else showToast('담당자 정보가 업데이트 되었습니다.');
    });
  };

  const handleStatusChange = (
    userId: string,
    status: 'ACTIVE' | 'INACTIVE',
    member: CalculatedMember
  ) => {
    if (
      status === 'INACTIVE' &&
      member.role === 'MANAGER' &&
      activeManagerCount <= 1
    ) {
      showToast('마지막 관리자입니다. 다른 관리자를 먼저 지정하세요.');
      return;
    }
    startTransition(async () => {
      const res = await setUserStatus(userId, status);
      if (res.error) showToast(`변경 실패: ${res.error}`);
      else
        showToast(
          status === 'ACTIVE'
            ? '계정이 정상 활성화되었습니다.'
            : '팀원이 비활성화(삭제 처리) 되었습니다.'
        );
    });
  };

  const handleRoleChange = (
    userId: string,
    role: 'MANAGER' | 'REP',
    member: CalculatedMember
  ) => {
    if (
      role === 'REP' &&
      member.role === 'MANAGER' &&
      member.status === 'ACTIVE' &&
      activeManagerCount <= 1
    ) {
      showToast('마지막 관리자의 권한은 변경할 수 없습니다.');
      return;
    }
    startTransition(async () => {
      const res = await setUserRole(userId, role);
      if (res.error) showToast(`변경 실패: ${res.error}`);
      else showToast(`권한이 ${role}로 변경되었습니다.`);
    });
  };

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    const f = inviteForm;
    if (!f.email.trim() || !f.name.trim()) {
      showToast('이메일과 이름은 필수입니다.');
      return;
    }
    startTransition(async () => {
      const res = await inviteMember(f);
      if (res.error) {
        showToast(`초대 실패: ${res.error}`);
        return;
      }
      setInviteOpen(false);
      setInviteForm({
        email: '',
        name: '',
        target_sales: 10000000,
        conversion_rate: 10,
        lead_time: 7,
      });
      showToast(`${f.email} 초대 등록 완료. 본인이 같은 이메일로 가입하면 자동 활성화됩니다.`);
    });
  };

  const handleCancelInvitation = (email: string) => {
    startTransition(async () => {
      const res = await cancelInvitation(email);
      if (res.error) showToast(`취소 실패: ${res.error}`);
      else showToast('초대가 취소되었습니다.');
    });
  };

  const totalIndividualTarget = members.reduce(
    (s, m) => s + (m.target_sales || 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight">조직 및 KPI 세팅</h1>
        <p className="text-[#4E5968] mt-1 text-sm font-medium">
          팀 전체의 목표를 설정하고, 담당자별 권한과 지표를 관리하세요.
        </p>
      </div>

      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-[#191F28] flex items-center">
            <Target className="w-5 h-5 mr-2 text-[#3182F6]" />
            팀 전체 KPI 목표
          </h2>
          <button
            onClick={() => setEditTeam(teamSettings)}
            className="text-sm font-bold text-[#3182F6] hover:bg-blue-100 bg-blue-50 px-4 py-2 rounded-xl transition-colors flex items-center"
          >
            <Edit2 className="w-4 h-4 mr-1.5" /> 팀 목표 수정
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiBox
            label="팀 월간 목표 실적"
            value={`${formatCurrency(teamSettings.target_sales)}원`}
            sub={`개별 합산: ${formatCurrency(totalIndividualTarget)}원`}
          />
          <KpiBox label="팀 기준 전환율" value={`${teamSettings.conversion_rate}%`} />
          <KpiBox label="팀 기준 리드타임" value={`${teamSettings.lead_time}일`} />
          <KpiBox
            label="팀 기준 객단가"
            value={`${formatCurrency(teamSettings.avg_deal_size)}원`}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-[#191F28] flex items-center">
            <Users className="w-5 h-5 mr-2 text-gray-700" />
            담당자별 목표 및 권한 관리
          </h2>
          <button
            onClick={() => setInviteOpen(true)}
            className="bg-[#191F28] hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> 팀원 초대 추가
          </button>
        </div>

        {invitations.length > 0 && (
          <div className="bg-orange-50/40 border border-orange-100 rounded-[20px] p-5 mb-4">
            <h3 className="text-sm font-bold text-orange-700 flex items-center mb-3">
              <Clock className="w-4 h-4 mr-1.5" /> 가입 대기 중인 초대 ({invitations.length})
            </h3>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.email}
                  className="bg-white rounded-xl p-3 flex items-center justify-between border border-orange-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#191F28] truncate">
                        {inv.name}{' '}
                        <span className="text-xs font-normal text-[#8B95A1]">
                          ({inv.email})
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8B95A1] font-medium">
                        목표 {formatCurrency(inv.target_sales)}원 · 전환율{' '}
                        {inv.conversion_rate}% · 리드타임 {inv.lead_time}일
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(inv.email)}
                    className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center transition-colors shrink-0 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 취소
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-orange-700/70 font-medium mt-3 leading-relaxed">
              ※ 초대받은 분이 같은 이메일로 회원가입하면 자동으로 ACTIVE + REP 권한이 부여됩니다.
              가입 사이트 주소를 따로 알려주세요.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#4E5968]">
              <thead className="bg-[#F9FAFB] text-[#8B95A1] font-bold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">담당자명</th>
                  <th className="px-6 py-4 whitespace-nowrap">권한</th>
                  <th className="px-6 py-4 whitespace-nowrap">계정 상태</th>
                  <th className="px-6 py-4 whitespace-nowrap">목표 실적 (원)</th>
                  <th className="px-6 py-4 whitespace-nowrap">달성 실적 (원)</th>
                  <th className="px-6 py-4 whitespace-nowrap">전월 대비 성장</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {members.map((member) => {
                  const isSelf = member.id === currentUser.id;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-[#191F28]">
                        {member.name}
                        <div className="text-[11px] text-[#8B95A1] font-normal">
                          {member.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isSelf ? (
                          <span className="bg-blue-50 text-[#3182F6] px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">
                            {member.role}
                          </span>
                        ) : (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(
                                member.id,
                                e.target.value as 'MANAGER' | 'REP',
                                member
                              )
                            }
                            className="text-xs bg-white border border-gray-200 rounded-md px-2 py-1 font-bold cursor-pointer hover:bg-gray-50"
                          >
                            <option value="REP">REP</option>
                            <option value="MANAGER">MANAGER</option>
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {member.status === 'ACTIVE' && (
                          <span className="bg-blue-50 text-[#3182F6] px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">
                            정상 활성
                          </span>
                        )}
                        {member.status === 'INACTIVE' && (
                          <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100">
                            삭제됨(데이터 보존)
                          </span>
                        )}
                        {member.status === 'PENDING' && (
                          <span className="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-md text-xs font-bold border border-orange-100">
                            승인 대기
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{formatCurrency(member.target_sales)}</td>
                      <td className="px-6 py-4 text-[#3182F6] font-bold">
                        {formatCurrency(member.current_sales)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`flex items-center ${
                            member.sales_growth >= 0 ? 'text-red-500' : 'text-blue-500'
                          }`}
                        >
                          {member.sales_growth >= 0 ? (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                          )}
                          {Math.abs(member.sales_growth).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.status === 'PENDING' && (
                            <button
                              onClick={() =>
                                handleStatusChange(member.id, 'ACTIVE', member)
                              }
                              className="text-xs font-bold bg-[#191F28] text-white px-3 py-1.5 rounded-lg hover:bg-black transition-colors"
                            >
                              가입 승인
                            </button>
                          )}
                          {member.status === 'ACTIVE' && !isSelf && (
                            <button
                              onClick={() =>
                                handleStatusChange(member.id, 'INACTIVE', member)
                              }
                              className="text-xs font-bold bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex items-center"
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> 팀원 삭제
                            </button>
                          )}
                          {member.status === 'INACTIVE' && (
                            <button
                              onClick={() =>
                                handleStatusChange(member.id, 'ACTIVE', member)
                              }
                              className="text-xs font-bold bg-gray-100 text-[#4E5968] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              복구
                            </button>
                          )}
                          <button
                            onClick={() => setEditMember(member)}
                            className="text-gray-400 hover:text-[#3182F6] transition-colors p-2 rounded-lg hover:bg-blue-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-[#8B95A1]">
                      아직 등록된 담당자가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <Modal title="팀원 초대" onClose={() => setInviteOpen(false)}>
          <form onSubmit={handleInvite} className="space-y-5">
            <Field
              label="이름 (성함)"
              type="text"
              value={inviteForm.name}
              onChange={(v) => setInviteForm({ ...inviteForm, name: String(v) })}
            />
            <Field
              label="이메일 (가입 시 사용할 이메일)"
              type="text"
              value={inviteForm.email}
              onChange={(v) => setInviteForm({ ...inviteForm, email: String(v) })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="목표 실적 (원)"
                type="number"
                value={inviteForm.target_sales}
                onChange={(v) =>
                  setInviteForm({ ...inviteForm, target_sales: Number(v) })
                }
              />
              <Field
                label="전환율 (%)"
                type="number"
                value={inviteForm.conversion_rate}
                onChange={(v) =>
                  setInviteForm({ ...inviteForm, conversion_rate: Number(v) })
                }
              />
              <div className="col-span-2">
                <Field
                  label="리드타임 (일)"
                  type="number"
                  value={inviteForm.lead_time}
                  onChange={(v) =>
                    setInviteForm({ ...inviteForm, lead_time: Number(v) })
                  }
                />
              </div>
            </div>
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
              <p className="text-[11px] text-[#3182F6] font-medium leading-relaxed">
                💡 초대 등록 후 본인이 같은 이메일로 회원가입하면 자동으로 ACTIVE + REP 권한이 부여됩니다.
                가입 사이트 주소(이 사이트 URL)를 따로 알려주세요.
              </p>
            </div>
            <ModalButtons label="초대하기" onCancel={() => setInviteOpen(false)} />
          </form>
        </Modal>
      )}

      {editTeam && (
        <Modal title="팀 전체 KPI 목표 수정" onClose={() => setEditTeam(null)}>
          <form onSubmit={handleSaveTeam} className="space-y-5">
            <Field
              label="팀 월간 목표 실적 (원)"
              type="number"
              value={editTeam.target_sales}
              onChange={(v) => setEditTeam({ ...editTeam, target_sales: Number(v) })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="팀 기준 전환율 (%)"
                type="number"
                value={editTeam.conversion_rate}
                onChange={(v) => setEditTeam({ ...editTeam, conversion_rate: Number(v) })}
              />
              <Field
                label="팀 기준 리드타임 (일)"
                type="number"
                value={editTeam.lead_time}
                onChange={(v) => setEditTeam({ ...editTeam, lead_time: Number(v) })}
              />
              <div className="col-span-2">
                <Field
                  label="팀 건당 평균 객단가 (원)"
                  type="number"
                  value={editTeam.avg_deal_size}
                  onChange={(v) =>
                    setEditTeam({ ...editTeam, avg_deal_size: Number(v) })
                  }
                />
              </div>
            </div>
            <ModalButtons onCancel={() => setEditTeam(null)} />
          </form>
        </Modal>
      )}

      {editMember && (
        <Modal title="팀원 정보 수정" onClose={() => setEditMember(null)}>
          <form onSubmit={handleSaveMember} className="space-y-5">
            <Field
              label="담당자 성함"
              type="text"
              value={editMember.name}
              onChange={(v) => setEditMember({ ...editMember, name: String(v) })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="목표 실적 (원)"
                type="number"
                value={editMember.target_sales}
                onChange={(v) =>
                  setEditMember({ ...editMember, target_sales: Number(v) })
                }
              />
              <Field
                label="현재 달성 (원)"
                type="number"
                value={editMember.current_sales}
                onChange={(v) =>
                  setEditMember({ ...editMember, current_sales: Number(v) })
                }
              />
              <Field
                label="전환율 (%)"
                type="number"
                value={editMember.conversion_rate}
                onChange={(v) =>
                  setEditMember({ ...editMember, conversion_rate: Number(v) })
                }
              />
              <Field
                label="리드타임 (일)"
                type="number"
                value={editMember.lead_time}
                onChange={(v) =>
                  setEditMember({ ...editMember, lead_time: Number(v) })
                }
              />
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="text-sm font-bold text-[#191F28] mb-3">
                보험설계사 정보
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    자격증 종류
                  </label>
                  <select
                    value={editMember.license_type ?? ''}
                    onChange={(e) =>
                      setEditMember({ ...editMember, license_type: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none cursor-pointer"
                  >
                    <option value="">선택</option>
                    <option value="LIFE">생명보험</option>
                    <option value="NON_LIFE">손해보험</option>
                    <option value="VARIABLE">변액보험</option>
                    <option value="LIFE_NON_LIFE">생명+손해</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    자격증 번호
                  </label>
                  <input
                    type="text"
                    value={editMember.license_number ?? ''}
                    onChange={(e) =>
                      setEditMember({
                        ...editMember,
                        license_number: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    자격증 만료일
                  </label>
                  <input
                    type="date"
                    value={editMember.license_expiry ?? ''}
                    onChange={(e) =>
                      setEditMember({
                        ...editMember,
                        license_expiry: e.target.value || null,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    입사일
                  </label>
                  <input
                    type="date"
                    value={editMember.hire_date ?? ''}
                    onChange={(e) =>
                      setEditMember({
                        ...editMember,
                        hire_date: e.target.value || null,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <Field
                    label="전화번호"
                    type="text"
                    value={editMember.phone ?? ''}
                    onChange={(v) =>
                      setEditMember({ ...editMember, phone: String(v) })
                    }
                  />
                </div>
              </div>
            </div>

            <ModalButtons onCancel={() => setEditMember(null)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function KpiBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#F9FAFB] rounded-[16px] p-5 border border-gray-100">
      <p className="text-xs text-[#8B95A1] font-bold mb-1">{label}</p>
      <p className="text-xl font-extrabold text-[#191F28]">{value}</p>
      {sub && <p className="text-[11px] text-[#8B95A1] mt-2 font-medium">{sub}</p>}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[24px] p-8 w-full max-w-lg shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-[#191F28] mb-6">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: 'text' | 'number';
  value: string | number;
  onChange: (v: string | number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#4E5968] mb-2">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) =>
          onChange(type === 'number' ? Number(e.target.value) : e.target.value)
        }
        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none transition-shadow"
      />
    </div>
  );
}

function ModalButtons({
  onCancel,
  label = '저장하기',
}: {
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="pt-4 mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-5 py-3 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200 transition-colors"
      >
        취소
      </button>
      <button
        type="submit"
        className="px-5 py-3 text-sm font-bold text-white bg-[#3182F6] rounded-xl hover:bg-blue-600 transition-colors"
      >
        {label}
      </button>
    </div>
  );
}
