-- Applied to production and verified on 2026-11-11.

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birthday_pay_eligible boolean NOT NULL DEFAULT true;
UPDATE public.employees SET birthday_pay_eligible = false
WHERE (employee_code = 'EMP-017' AND full_name = 'Ronald Lomibao Reyes')
   OR (employee_code = 'EMP-019' AND full_name = 'Jomar Loyola Cerezo');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.employees WHERE birthday_pay_eligible = false AND employee_code IN ('EMP-017','EMP-019')) <> 2
 THEN RAISE EXCEPTION 'Birthday-pay exemption match count mismatch'; END IF;
END $$;
CREATE OR REPLACE FUNCTION private.enforce_birthday_pay_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_eligible boolean; v_removed numeric;
BEGIN
 IF TG_OP='UPDATE' AND (
   COALESCE(OLD.payroll_approved,false) OR COALESCE(OLD.payroll_locked,false)
   OR COALESCE(OLD.payroll_released,false)
   OR LOWER(COALESCE(OLD.payroll_status,'')) IN ('approved','released')
 ) THEN RETURN NEW; END IF;
 SELECT e.birthday_pay_eligible INTO v_eligible
 FROM public.employees e WHERE e.id=NEW.employee_id;
 IF v_eligible IS FALSE AND COALESCE(NEW.birthday_pay,0)>0 THEN
   v_removed := GREATEST(0,NEW.birthday_pay);
   NEW.birthday_pay := 0;
   NEW.total_earnings := GREATEST(0, COALESCE(NEW.total_earnings,0)-v_removed);
   NEW.net_pay := GREATEST(0, COALESCE(NEW.net_pay,0)-v_removed);
   IF COALESCE(NEW.gross_pay,0)>0 THEN
     NEW.gross_pay := GREATEST(0,NEW.gross_pay-v_removed);
   END IF;
 END IF;
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION private.enforce_birthday_pay_eligibility() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_enforce_birthday_pay_eligibility ON public.payroll_records;
CREATE TRIGGER trg_enforce_birthday_pay_eligibility
BEFORE INSERT OR UPDATE ON public.payroll_records
FOR EACH ROW WHEN (COALESCE(NEW.birthday_pay,0)>0)
EXECUTE FUNCTION private.enforce_birthday_pay_eligibility();

WITH corrected AS (
 UPDATE public.payroll_records p
 SET birthday_pay=0,
     total_earnings=GREATEST(0,COALESCE(p.total_earnings,0)-COALESCE(p.birthday_pay,0)),
     net_pay=GREATEST(0,COALESCE(p.net_pay,0)-COALESCE(p.birthday_pay,0)),
     gross_pay=CASE WHEN COALESCE(p.gross_pay,0)>0
       THEN GREATEST(0,p.gross_pay-COALESCE(p.birthday_pay,0)) ELSE p.gross_pay END
 WHERE p.employee_id IN (
   SELECT e.id FROM public.employees e
   WHERE e.birthday_pay_eligible=false AND e.employee_code IN ('EMP-017','EMP-019'))
 AND p.payroll_end >= DATE '2026-10-26'
 AND COALESCE(p.birthday_pay,0)>0
 AND NOT COALESCE(p.payroll_approved,false)
 AND NOT COALESCE(p.payroll_locked,false)
 AND NOT COALESCE(p.payroll_released,false)
 AND LOWER(COALESCE(p.payroll_status,'draft')) NOT IN ('released','approved')
 RETURNING p.employee_code,p.payroll_start,p.payroll_end
)
INSERT INTO public.audit_logs(action,performed_by,target_employee,details)
SELECT 'BIRTHDAY PAY EXEMPTION APPLIED','Owner requested through ChatGPT',c.employee_code,
format('Removed birthday allowance from open draft payroll %s to %s, adjusted earnings and net pay.',c.payroll_start,c.payroll_end)
FROM corrected c;

INSERT INTO public.audit_logs(action,performed_by,target_employee,details)
VALUES
('BIRTHDAY PAY ELIGIBILITY CHANGED','Owner requested through ChatGPT','Ronald Lomibao Reyes (EMP-017)','Set birthday_pay_eligible=false; future and unreleased payroll only.'),
('BIRTHDAY PAY ELIGIBILITY CHANGED','Owner requested through ChatGPT','Jomar Loyola Cerezo (EMP-019)','Set birthday_pay_eligible=false; future and unreleased payroll only.');

