# Basic Pitch のモデル出力（音・音の出だし・細かい音高）を npz に保存する
#   python transcribe.py 音.wav 出力.npz [音2.wav 出力2.npz ...]
import sys, os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
from basic_pitch.inference import run_inference, Model
from basic_pitch import ICASSP_2022_MODEL_PATH
model = Model(ICASSP_2022_MODEL_PATH)
for src, out in zip(sys.argv[1::2], sys.argv[2::2]):
    o = run_inference(src, model)
    np.savez_compressed(out, note=o['note'], onset=o['onset'], contour=o['contour'])
    print(out, {k: v.shape for k, v in o.items()})
