-- =============================================================
-- 006 - 카테고리 대/소 분리 + 보장 형태 구조화
--   1) deals 추가 컬럼
--      - insurance_line     ('손보' | '생보')
--      - category_sub       (소카테고리 — 라인별로 다름)
--      - coverage_type      ('갱신형' | '비갱신형' | '종신형')
--      - coverage_detail    (세부 옵션, 예: '20/100', '5년납', '10년갱신')
--      - coverage_custom    (보장 형태 "기타" 직접입력)
--   ※ category_custom 컬럼은 소카 "기타" 직접입력에 재활용 (기존 컬럼)
--   ※ 기존 category / renewal_type / maturity_type / maturity_custom 컬럼은
--     호환을 위해 유지되지만 UI 에서는 더 이상 사용하지 않음
-- =============================================================

alter table public.deals add column if not exists insurance_line text default '';
alter table public.deals add column if not exists category_sub text default '';
alter table public.deals add column if not exists coverage_type text default '';
alter table public.deals add column if not exists coverage_detail text default '';
alter table public.deals add column if not exists coverage_custom text default '';
