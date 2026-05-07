'use client';

import { useState, useTransition, type FormEvent } from 'react';
import {
  Target,
  Users,
  Edit2,
  X,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  updateMemberKpi,
  updateTeamSettings,
  setUserStatus,
  setUserRole,
} from '@/lib/actions';
import { formatCurrency } from '@/lib/utils';
import type { Profile, CalculatedMember, TeamSettings } from '@/lib/types';

export default function ManagerClient({
  currentUser,
  members,
  teamSettings,
}: {
  currentUser: Profile;
  members: CalculatedMember[];
  teamSettings: TeamSettings;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [editTeam, setEditTeam] = useState<TeamSettings | null>(null);
  const [editMember, setEditMember] = useState<CalculatedMember | null>(null);

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
    status: 'ACTIVE' | 'INACTIVE'
  ) => {
    startTransition(async () => {
      const res = await setUserStatus(userId, status);
      if (res.error) showToast(`변경 실패: ${res.error}`);
      else
        showToast(
          status === 'ACTIVE' ? '계정이 정상 활성화되었습니다.' : '접속 권한이 회수되었습니다.'
        );
    });
  };

  const handleRoleChange = (userId: string, role: 'MANAGER' | 'REP') => {
    startTransition(async () => {
      const res = await setUserRole(userId, role);
      if (res.error) showToast(`변경 실패: ${res.error}`);
      else showToast(`권한이 ${role}로 변경되었습니다.`);
    });
  };

  const totalIndividualTarget = members.reduce(
    (s, m) => s + (m.target_sales || 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#191F28] tracking-tight">조직 및 KPI 세팅</h1>
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
        <h2 className="text-lg font-bold text-[#191F28] flex items-center mb-4">
          <Users className="w-5 h-5 mr-2 text-gray-700" />
          담당자별 목표 및 권한 관리
        </h2>

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
                              handleRoleChange(member.id, e.target.value as 'MANAGER' | 'REP')
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
                            접근 차단
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
                              onClick={() => handleStatusChange(member.id, 'ACTIVE')}
                              className="text-xs font-bold bg-[#191F28] text-white px-3 py-1.5 rounded-lg hover:bg-black transition-colors"
                            >
                              가입 승인
                            </button>
                          )}
                          {member.status === 'ACTIVE' && !isSelf && (
                            <button
                              onClick={() => handleStatusChange(member.id, 'INACTIVE')}
                              className="text-xs font-bold bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              권한 회수
                            </button>
                          )}
                          {member.status === 'INACTIVE' && (
                            <button
                              onClick={() => handleStatusChange(member.id, 'ACTIVE')}
                              className="text-xs font-bold bg-gray-100 text-[#4E5968] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              권한 복구
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
                  onChange={(v) => setEditTeam({ ...editTeam, avg_deal_size: Number(v) })}
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
                onChange={(v) => setEditMember({ ...editMember, lead_time: Number(v) })}
              />
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

function ModalButtons({ onCancel }: { onCancel: () => void }) {
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
        저장하기
      </button>
    </div>
  );
}
