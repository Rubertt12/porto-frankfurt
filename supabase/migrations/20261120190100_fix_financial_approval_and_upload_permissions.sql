-- Allow the dedicated financial team to review documents and publish transactions.
DROP POLICY IF EXISTS financial_documents_insert ON public.financial_documents;
CREATE POLICY financial_documents_insert ON public.financial_documents
FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
  AND (uploaded_by IS NULL OR uploaded_by=(SELECT auth.uid()))
);
DROP POLICY IF EXISTS financial_documents_select_admin ON public.financial_documents;
CREATE POLICY financial_documents_select_admin ON public.financial_documents
FOR SELECT TO authenticated
USING (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
);
DROP POLICY IF EXISTS financial_documents_update ON public.financial_documents;
CREATE POLICY financial_documents_update ON public.financial_documents
FOR UPDATE TO authenticated
USING (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
)
WITH CHECK (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
);
DROP POLICY IF EXISTS financial_documents_delete ON public.financial_documents;
CREATE POLICY financial_documents_delete ON public.financial_documents
FOR DELETE TO authenticated
USING (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
  AND review_status <> 'approved'
);
DROP POLICY IF EXISTS finance_admin_insert ON public.financial_transactions;
CREATE POLICY finance_admin_insert ON public.financial_transactions
FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
  AND (created_by IS NULL OR created_by=(SELECT auth.uid()))
);
DROP POLICY IF EXISTS finance_admin_select ON public.financial_transactions;
CREATE POLICY finance_admin_select ON public.financial_transactions
FOR SELECT TO authenticated
USING (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
);
DROP POLICY IF EXISTS finance_admin_update ON public.financial_transactions;
CREATE POLICY finance_admin_update ON public.financial_transactions
FOR UPDATE TO authenticated
USING (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
)
WITH CHECK (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
);
DROP POLICY IF EXISTS finance_admin_delete ON public.financial_transactions;
CREATE POLICY finance_admin_delete ON public.financial_transactions
FOR DELETE TO authenticated
USING (
  public.can_access_condominium(condominium_id)
  AND public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
  AND approval_status <> 'approved'
);
DROP POLICY IF EXISTS financial_files_admin_insert ON storage.objects;
CREATE POLICY financial_files_admin_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='condo-financial'
  AND public.has_condominium_role(((storage.foldername(name))[1])::uuid,ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
);
DROP POLICY IF EXISTS financial_files_admin_delete ON storage.objects;
CREATE POLICY financial_files_admin_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id='condo-financial'
  AND public.has_condominium_role(((storage.foldername(name))[1])::uuid,ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
);
DROP POLICY IF EXISTS financial_files_admin_read ON storage.objects;
CREATE POLICY financial_files_admin_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='condo-financial'
  AND public.can_access_condominium(((storage.foldername(name))[1])::uuid)
  AND (
    public.has_condominium_role(((storage.foldername(name))[1])::uuid,ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role])
    OR EXISTS (
      SELECT 1 FROM public.financial_documents d
      WHERE d.storage_path=objects.name
        AND d.review_status='approved'
        AND public.is_linked_to_condominium(d.condominium_id)
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_source_document_uidx
ON public.financial_transactions(source_document_id)
WHERE source_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.approve_financial_document(p_document_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_doc public.financial_documents%ROWTYPE;
  v_uid uuid := (SELECT auth.uid());
BEGIN
  SELECT * INTO v_doc FROM public.financial_documents
  WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento financeiro não encontrado.'; END IF;
  IF NOT public.can_access_condominium(v_doc.condominium_id)
     OR NOT public.has_condo_role(ARRAY['super_admin'::public.condo_role,'syndic'::public.condo_role,'administrator'::public.condo_role,'financial'::public.condo_role]) THEN
    RAISE EXCEPTION 'Você não tem permissão para aprovar este documento.';
  END IF;
  IF v_doc.review_status <> 'pending' THEN
    RAISE EXCEPTION 'Somente documentos aguardando aprovação podem ser aprovados.';
  END IF;
  IF COALESCE(v_doc.detected_amount,0)>0 THEN
    INSERT INTO public.financial_transactions (
      condominium_id,transaction_type,description,category,amount,competence_date,
      status,document_path,source_document_id,created_by,approval_status,approved_by,approved_at
    ) VALUES (
      v_doc.condominium_id,COALESCE(NULLIF(v_doc.detected_type,''),'expense'),
      v_doc.title,COALESCE(NULLIF(v_doc.detected_category,''),NULLIF(v_doc.category,''),'Outras despesas'),
      v_doc.detected_amount,COALESCE(v_doc.detected_date,v_doc.document_date,CURRENT_DATE),
      'pending',v_doc.storage_path,v_doc.id,v_uid,'approved',v_uid,now()
    ) ON CONFLICT (source_document_id) WHERE source_document_id IS NOT NULL DO NOTHING;
  END IF;
  UPDATE public.financial_documents SET review_status='approved',approved_by=v_uid,approved_at=now(),updated_at=now()
  WHERE id=v_doc.id;
  RETURN v_doc.id;
END;
$function$;
REVOKE ALL ON FUNCTION public.approve_financial_document(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_financial_document(uuid) TO authenticated;
