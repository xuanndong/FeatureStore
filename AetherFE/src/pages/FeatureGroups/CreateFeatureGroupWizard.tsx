import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { registryApi } from '@/services/registry';
import { studioApi } from '@/services/studio';
import { useNotification } from '@/components/ui/Notification';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ArrowLeft } from 'lucide-react';

import { StepIndicator } from '@/pages/FeatureGroups/wizard/StepIndicator';
import { Step1Entity } from '@/pages/FeatureGroups/wizard/Step1Entity';
import { Step2Source } from '@/pages/FeatureGroups/wizard/Step2Source';
import { Step3Transform } from '@/pages/FeatureGroups/wizard/Step3Transform';
import { FinishModal } from '@/pages/FeatureGroups/wizard/FinishModal';
import { PreviewModal } from '@/pages/FeatureGroups/wizard/PreviewModal';

import type {
  EntityOption, DataSourceOption, TransformationPreview,
  ScheduleInterval, WizardEntityStep, WizardSourceStep, WizardTransformStep
} from '@/types';

export const CreateFeatureGroupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // --- Step 1: Entity ---
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [entityStep, setEntityStep] = useState<WizardEntityStep>({});
  const [entityExpand, setEntityExpand] = useState<'choose' | 'create' | null>('choose');

  // --- Step 2: Source ---
  const [sourceOptions, setSourceOptions] = useState<DataSourceOption[]>([]);
  const [sourceStep, setSourceStep] = useState<WizardSourceStep>({
    new_source_config: { name: '', source_type: 'BATCH', source_format: 'PARQUET', location_uri: '' }
  });
  const [sourceExpand, setSourceExpand] = useState<'choose' | 'create' | null>('choose');
  const [isCheckingSource, setIsCheckingSource] = useState(false);

  // --- Step 3: Transformation ---
  const [transformStep, setTransformStep] = useState<WizardTransformStep>({
    transformation_name: '', 
    transform_type: 'SQL',
    transform_definition: '-- Viết logic biến đổi SQL tại đây\nSELECT * FROM source_data;',
    previewOk: false
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<TransformationPreview | null>(null);

  // --- Finish Modal ---
  const [fgName, setFgName] = useState('');
  const [useOnlineStore, setUseOnlineStore] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [cronExp, setCronExp] = useState<ScheduleInterval>('daily');

  useEffect(() => {
    registryApi.getEntityOptions().then(res => setEntityOptions(res.data)).catch(console.error);
    registryApi.getSourceOptions().then(res => setSourceOptions(res.data)).catch(console.error);
  }, []);

  const isStep1Valid = Boolean(
    entityStep.entity_id || 
    (entityStep.new_entity_config?.name?.trim() && entityStep.new_entity_config?.join_key?.trim())
  );

  const isStep2Valid = Boolean(
    sourceStep.source_id || 
    (sourceStep.new_source_config?.name?.trim() && sourceStep.connectionChecked)
  );

  const isStep3Valid = Boolean(
    transformStep.transformation_name?.trim() && transformStep.previewOk
  );

  const handleCheckSource = useCallback(async () => {
    const { new_source_config } = sourceStep;
    if (!new_source_config?.location_uri) return;

    try {
      setIsCheckingSource(true);
      setSourceStep(prev => ({ ...prev, connectionChecked: false, connectionError: null }));

      await registryApi.testConnection({ 
        location_uri: new_source_config.location_uri,
        connection_options: new_source_config.connection_options 
      });

      setSourceStep(prev => ({ ...prev, connectionChecked: true }));
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Lỗi kết nối';
      setSourceStep(prev => ({ ...prev, connectionChecked: false, connectionError: message }));
    } finally {
      setIsCheckingSource(false);
    }
  }, [sourceStep.new_source_config]);

  const handleRunScript = useCallback(async () => {
    try {
      setIsPreviewing(true);
      const res = await studioApi.previewTransformation({
        source_id: sourceStep.source_id,
        new_source_config: sourceStep.source_id ? undefined : sourceStep.new_source_config,
        transform_type: transformStep.transform_type,
        transform_definition: transformStep.transform_definition,
        limit: 10
      });
      setPreviewResult(res.data);
      setTransformStep(prev => ({ ...prev, previewOk: true, inferredFeatures: res.data.inferred_features }));
      showNotification('success', 'Chạy script thành công!');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Lỗi khi chạy script');
      setTransformStep(prev => ({ ...prev, previewOk: false }));
    } finally {
      setIsPreviewing(false);
    }
  }, [sourceStep, transformStep.transform_type, transformStep.transform_definition, showNotification]);

  const handleFinish = useCallback(async () => {
    if (!fgName) return showNotification('error', 'Vui lòng nhập tên Feature Group');
    try {
      setIsSubmitting(true);
      await studioApi.createFeatureGroup({
        name: fgName,
        use_online_store: useOnlineStore,
        entity_id: entityStep.entity_id, new_entity_config: entityStep.entity_id ? undefined : entityStep.new_entity_config,
        source_id: sourceStep.source_id, new_source_config: sourceStep.source_id ? undefined : sourceStep.new_source_config,
        transformation_name: transformStep.transformation_name, transform_type: transformStep.transform_type,
        transform_definition: transformStep.transform_definition, features: transformStep.inferredFeatures || [],
        is_scheduled: isScheduled, cron_expression: isScheduled ? cronExp : undefined
      });

      showNotification('success', 'Tạo Feature Group thành công!');
      navigate('/feature-groups');

    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Lỗi khi tạo Feature Group');

    } finally {
      setIsSubmitting(false);
    }
  }, [fgName, useOnlineStore, entityStep, sourceStep, transformStep, isScheduled, cronExp, navigate, showNotification]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Come back */}
      <div>
        <button 
          className="btn btn-ghost" 
          onClick={() => setShowCancelModal(true)} 
          style={{ padding: 0, gap: '6px', color: 'var(--text-secondary)', marginBottom: '16px' }}
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Trình tạo Feature Group</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Kết nối các thực thể, nguồn dữ liệu và logic biến đổi để định nghĩa một Feature Group mới trong Aether Registry.</p>
        </div>
      </div>

      <StepIndicator currentStep={step} />

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
              {step === 1 ? 'Thực thể' : step === 2 ? 'Nguồn dữ liệu' : 'Logic biến đổi'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {step === 1 ? 'Định nghĩa thực thể gốc cho tập dữ liệu này.' : step === 2 ? 'Thiết lập kết nối đến hạ tầng dữ liệu của bạn để bắt đầu trích xuất features.' : 'Công thức tính toán hoặc mã xử lý để biến đổi dữ liệu thô thành các đặc trưng có giá trị.'}
            </p>
          </div>
          <div style={{ background: 'var(--surface)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>BƯỚC {step} / 3</div>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 1 && (
            <Step1Entity
              entityOptions={entityOptions}
              entityStep={entityStep}
              entityExpand={entityExpand}
              onExpandChange={setEntityExpand}
              onStepChange={setEntityStep}
            />
          )}

          {step === 2 && (
            <Step2Source
              sourceOptions={sourceOptions}
              sourceStep={sourceStep}
              sourceExpand={sourceExpand}
              isCheckingSource={isCheckingSource}
              onExpandChange={setSourceExpand}
              onStepChange={setSourceStep}
              onCheckSource={handleCheckSource}
            />
          )}

          {step === 3 && (
            <Step3Transform
              transformStep={transformStep} 
              sourceFormat={sourceStep.new_source_config?.source_format || 'PARQUET'} 
              isPreviewing={isPreviewing} 
              onStepChange={setTransformStep} 
              onRunScript={handleRunScript} 
            />
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
          <button className="btn btn-ghost" onClick={() => step > 1 ? setStep((step - 1) as 1 | 2 | 3) : setShowCancelModal(true)}>
            Quay lại
          </button>
          
          {step < 3 ? (
            <button 
              className="btn btn-secondary" 
              onClick={() => setStep((step + 1) as 1 | 2 | 3)} 
              disabled={step === 1 ? !isStep1Valid : !isStep2Valid} 
              style={{ 
                background: (step === 1 ? isStep1Valid : isStep2Valid) ? '#000000' : '#7c3aed', 
                color: 'white', 
                border: 'none',
                cursor: (step === 1 ? isStep1Valid : isStep2Valid) ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s ease-in-out'
              }}
            >
              Tiếp theo →
            </button>
          ) : (
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowFinishModal(true)} 
              disabled={!isStep3Valid} 
              style={{ 
                background: isStep3Valid ? '#000000' : '#d1d5db', 
                color: 'white', 
                border: 'none',
                cursor: isStep3Valid ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s ease-in-out'
              }}
            >
              Hoàn thành →
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showCancelModal} title="Hủy quá trình" message="Bạn có chắc chắn muốn hủy? Mọi thay đổi sẽ bị xóa" confirmText="Đồng ý"
        onCancel={() => setShowCancelModal(false)}
        onConfirm={() => { showNotification('info', 'Đã hủy quá trình tạo.'); navigate('/feature-groups'); }}
      />

      <FinishModal
        isOpen={showFinishModal} 
        fgName={fgName} 
        useOnlineStore={useOnlineStore} 
        isScheduled={isScheduled} 
        cronExp={cronExp} 
        isSubmitting={isSubmitting}
        onClose={() => setShowFinishModal(false)} 
        onFinish={handleFinish} 
        onFgNameChange={setFgName} 
        onUseOnlineStoreChange={setUseOnlineStore} 
        onScheduledChange={setIsScheduled} 
        onCronExpChange={setCronExp}
      />

      {previewResult && (
        <PreviewModal 
          previewResult={previewResult} 
          onClose={() => setPreviewResult(null)} 
        />
      )}
    </div>
  );
};
