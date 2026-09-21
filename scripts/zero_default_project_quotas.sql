-- Idempotent: turn unused default project caps off. Demo projects at 300000/12000 are kept.
UPDATE billing_project_quotas
   SET quota_limit = 0
 WHERE quota_limit = 100000
   AND quota_consumed = 0;
