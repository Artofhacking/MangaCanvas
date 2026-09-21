-- Run before BILLING_ENFORCE_QUOTAS=1.
-- Expect: enterprise 1_000_000; seed org 1_000_000; project layer only demo rows at 300000.
SELECT 'enterprise' AS layer, id AS ref, quota_limit, quota_consumed
  FROM billing_enterprise_quota
 WHERE quota_limit > 0
UNION ALL
SELECT 'org', organization_id, quota_limit, quota_consumed
  FROM billing_organization_quotas
 WHERE quota_limit > 0
UNION ALL
SELECT 'project', project_id, quota_limit, quota_consumed
  FROM billing_project_quotas
 WHERE quota_limit > 0;
