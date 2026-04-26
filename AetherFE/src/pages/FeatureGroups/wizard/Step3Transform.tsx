import React from 'react';
import Editor from '@monaco-editor/react';
import type { TransformationType, WizardTransformStep, SourceFormat } from '@/types';

// ==========================================
// TEMPLATES (UDF & SQL)
// ==========================================
const TEMPLATES: Record<string, string> = {
  IMAGE: `import numpy as np
import cv2
import base64

class UDFProcessor:
    def __init__(self, dataset_name):
        self.ds_name = dataset_name

    def __call__(self, batch):
        results_list = []
        for img in batch['image']:
            if img is None:
                continue
            h_img, w_img = img.shape[:2]
            gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY)
            _, buffer = cv2.imencode('.jpg', gray)
            
            results_list.append({
                "width": w_img,
                "height": h_img,
                "thumbnail_gray": base64.b64encode(buffer).decode('utf-8'),
                "status": "SUCCESS"
            })
        return results_list`,

  VIDEO: `import cv2
import tempfile

class VideoProcessor:
    def __init__(self, dataset_name, fs):
        self.ds_name = dataset_name
        self.fs = fs

    def __call__(self, batch):
        results = []
        for path in batch["path"]:
            try:
                with self.fs.open(path, 'rb') as f_in:
                    with tempfile.NamedTemporaryFile(delete=True, suffix=".mp4") as tmp_file:
                        tmp_file.write(f_in.read())
                        tmp_file.flush()
                        
                        cap = cv2.VideoCapture(tmp_file.name)
                        results.append({
                            "video_path": path,
                            "fps": round(cap.get(cv2.CAP_PROP_FPS), 2),
                            "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                            "status": "SUCCESS"
                        })
                        cap.release()
            except Exception as e:
                results.append({"video_path": path, "error": str(e), "status": "FAILED"})
        return results`,

  AUDIO: `import wave
import io

class AudioProcessor:
    def __init__(self, dataset_name, fs):
        self.ds_name = dataset_name
        self.fs = fs

    def __call__(self, batch):
        results = []
        for path in batch["path"]:
            try:
                with self.fs.open(path, 'rb') as f:
                    with wave.open(io.BytesIO(f.read()), 'rb') as wav_file:
                        results.append({
                            "audio_path": path,
                            "channels": wav_file.getnchannels(),
                            "sample_rate_hz": wav_file.getframerate(),
                            "status": "SUCCESS"
                        })
            except Exception as e:
                results.append({"audio_path": path, "error": str(e), "status": "FAILED"})
        return results`,

  TEXT: `class TextProcessor:
    def __init__(self, dataset_name):
        self.ds_name = dataset_name

    def __call__(self, batch):
        results = []
        for text in batch["text"]:
            clean_text = str(text).strip()
            results.append({
                "char_count": len(clean_text),
                "word_count": len(clean_text.split()),
                "preview": clean_text[:50] + "...",
                "status": "SUCCESS"
            })
        return results`,

  STRUCTURED: `import pandas as pd

class TabularProcessor:
    def __init__(self, dataset_name):
        self.ds_name = dataset_name

    def __call__(self, batch):
        # Ép kiểu batch thành Pandas DataFrame
        df = pd.DataFrame(batch)

        # Logic mẫu: Lọc dữ liệu và tạo feature mới
        if "amount" in df.columns:
            df = df[df["amount"] > 0].copy()
            df["discounted_amount"] = df["amount"] * 0.9
            df["spend_category"] = df["amount"].apply(lambda x: "High" if x > 1000 else "Low")

        return df`,

  SQL: `SELECT 
    COUNT(*) as total_records,
    MAX(amount) as max_amount,
    MIN(amount) as min_amount
FROM source_data;`,

  AGGREGATION: `-- Tính năng Aggregation đang được phát triển
-- Vui lòng sử dụng SQL hoặc Python UDF`
};

// ==========================================
// COMPONENT
// ==========================================
interface Step3TransformProps {
  transformStep: WizardTransformStep;
  sourceFormat?: SourceFormat; 
  isPreviewing: boolean;
  onStepChange: (step: WizardTransformStep) => void;
  onRunScript: () => void;
}

export const Step3Transform: React.FC<Step3TransformProps> = React.memo(({
  transformStep, sourceFormat = 'PARQUET', isPreviewing, onStepChange, onRunScript
}) => {

  const getTemplate = (type: TransformationType, format: SourceFormat) => {
    if (type === 'SQL') return TEMPLATES.SQL;
    if (type === 'AGGREGATION') return TEMPLATES.AGGREGATION;
    
    if (format === 'IMAGE') return TEMPLATES.IMAGE;
    if (format === 'VIDEO') return TEMPLATES.VIDEO;
    if (format === 'AUDIO') return TEMPLATES.AUDIO;
    if (format === 'TEXT') return TEMPLATES.TEXT;
    
    return TEMPLATES.STRUCTURED;
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as TransformationType;
    onStepChange({ 
      ...transformStep, 
      transform_type: newType, 
      transform_definition: getTemplate(newType, sourceFormat), 
      previewOk: false 
    });
  };

  const handleResetTemplate = () => {
    onStepChange({ 
      ...transformStep, 
      transform_definition: getTemplate(transformStep.transform_type, sourceFormat), 
      previewOk: false 
    });
  };

  return (
    <div className="wizard-step3-grid">
      <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <Editor
          height="100%"
          language={transformStep.transform_type === 'SQL' ? 'sql' : 'python'}
          theme="vs-dark"
          value={transformStep.transform_definition}
          onChange={(val) => onStepChange({ ...transformStep, transform_definition: val || '', previewOk: false })}
          options={{ minimap: { enabled: false }, fontSize: 13 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '9rem' }}>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', background: '#7c3aed', color: 'white', border: 'none' }}
            onClick={onRunScript}
            disabled={isPreviewing}
          >
            {isPreviewing ? <div className="spinner spinner-sm" /> : '▶ Run Script'}
          </button>
          
          <button
            className="btn btn-reset"
            onClick={handleResetTemplate}
            title="Tải lại code mẫu mặc định"
          >
            ↺ Khôi phục code mẫu
          </button>
        </div>

        <div>
          <label className="form-label">TYPE</label>
          <select
            className="form-select"
            value={transformStep.transform_type}
            onChange={handleTypeChange}
          >
            <option value="SQL">SQL</option>
            <option value="PYTHON_UDF">Python UDF</option>
            <option value="AGGREGATION">Aggregation</option>
          </select>
        </div>

        <div>
          <label className="form-label">TRANSFORMATION NAME</label>
          <input
            type="text" className="form-input" placeholder="user_daily_activity"
            value={transformStep.transformation_name}
            onChange={(e) => onStepChange({ ...transformStep, transformation_name: e.target.value })}
          />
        </div>

        {transformStep.previewOk && (
          <div style={{ color: '#10b981', fontSize: '13px', fontWeight: 500 }}>✓ Script hợp lệ</div>
        )}
      </div>
    </div>
  );
});

Step3Transform.displayName = 'Step3Transform';
