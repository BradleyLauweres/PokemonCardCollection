import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Upload, RotateCcw, Check, Heart, Plus, Search, AlertCircle, Sparkles, RefreshCw, Zap, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { parseCardCode, preprocessCardCanvas, recognizeCardText, fetchCardMatch } from '../ocrScanner';
import { findUserCardEntry, canonicalSetId } from '../api';

export default function CardScannerModal({
  isOpen,
  onClose,
  sets = [],
  currentSetId = null,
  userCollectionMap = {},
  onToggleCard,
  onToggleWanted,
  onQuantityChange,
  onInspectCard
}) {
  const [stream, setStream] = useState(null);
  const [hasCameraAccess, setHasCameraAccess] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);

  const initialSetId = (currentSetId && currentSetId !== 'all_owned' && currentSetId !== 'wanted_list' && currentSetId !== 'global_search')
    ? (canonicalSetId(currentSetId) || currentSetId)
    : (sets[0]?.id || '');

  const [scannedNumber, setScannedNumber] = useState('');
  const [scannedSetId, setScannedSetId] = useState(initialSetId);
  const [rawOcrText, setRawOcrText] = useState('');

  const [matchedCard, setMatchedCard] = useState(null);
  const [isFetchingCard, setIsFetchingCard] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const resetState = useCallback(() => {
    setIsScanning(false);
    setScanStatus('');
    setErrorMessage('');
    setScannedNumber('');
    setScannedSetId(initialSetId);
    setRawOcrText('');
    setMatchedCard(null);
    setTorchEnabled(false);
  }, [initialSetId]);

  const handleModalClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraAccess(false);
        setErrorMessage('Camera access is not supported by your browser. You can take or upload a photo instead.');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasCameraAccess(true);
      setErrorMessage('');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }

      const track = mediaStream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          setHasTorchSupport(true);
        }
      }
    } catch {
      setHasCameraAccess(false);
      setErrorMessage('Camera access was blocked or unavailable. You can take or upload a photo of the card instead.');
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    if (isOpen) {
      const initCam = async () => {
        if (isActive) {
          await startCamera();
        }
      };
      initCam();
    } else {
      stopCamera();
    }

    return () => {
      isActive = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        const nextTorch = !torchEnabled;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchEnabled(nextTorch);
      } catch {}
    }
  };

  const lookupCard = async (setId, number) => {
    if (!setId || !number) return;
    setIsFetchingCard(true);
    setErrorMessage('');

    try {
      const card = await fetchCardMatch(setId, number);
      if (card) {
        setMatchedCard(card);
        setScanStatus('');
      } else {
        setErrorMessage(`Card #${number} was not found in set "${setId}". Check the number or pick another set below.`);
      }
    } catch {
      setErrorMessage('Failed to connect to Pokémon database. Please try again.');
    } finally {
      setIsFetchingCard(false);
    }
  };

  const processImageForCard = async (imageOrCanvas) => {
    setIsScanning(true);
    setScanStatus('Reading card code with OCR...');
    setErrorMessage('');
    setMatchedCard(null);

    try {
      const text = await recognizeCardText(imageOrCanvas);
      setRawOcrText(text);

      const parsed = parseCardCode(text, currentSetId || scannedSetId);

      if (parsed && (parsed.cardNumber || parsed.detectedSetId)) {
        const num = parsed.cardNumber || '';
        const setId = parsed.detectedSetId || scannedSetId || currentSetId || (sets[0]?.id || '');

        setScannedNumber(num);
        if (setId) setScannedSetId(setId);

        if (num && setId) {
          setScanStatus(`Found code: #${num} (${setId.toUpperCase()}). Loading card...`);
          await lookupCard(setId, num);
        } else if (num) {
          setScanStatus(`Found Card #${num}. Select set below to fetch.`);
        } else {
          setScanStatus('Detected set. Enter card number below to finish search.');
        }
      } else {
        setErrorMessage('Could not clearly detect the card code. Align the bottom corner with the code in focus, or enter the card number below.');
      }
    } catch {
      setErrorMessage('OCR processing failed. You can enter the card number below or upload a photo.');
    } finally {
      setIsScanning(false);
    }
  };

  const captureLiveFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;

    const video = videoRef.current;
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    // Crop box focused on the bottom code area of the card
    const cropBox = {
      x: Math.floor(videoWidth * 0.1),
      y: Math.floor(videoHeight * 0.6),
      width: Math.floor(videoWidth * 0.8),
      height: Math.floor(videoHeight * 0.35)
    };

    const processedCanvas = preprocessCardCanvas(video, cropBox);
    if (!processedCanvas) {
      setErrorMessage('Failed to capture camera frame.');
      return;
    }

    await processImageForCard(processedCanvas);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const cropBox = {
          x: Math.floor(img.width * 0.05),
          y: Math.floor(img.height * 0.6),
          width: Math.floor(img.width * 0.9),
          height: Math.floor(img.height * 0.38)
        };
        const processedCanvas = preprocessCardCanvas(img, cropBox);
        await processImageForCard(processedCanvas || img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSearch = (e) => {
    if (e) e.preventDefault();
    if (scannedSetId && scannedNumber) {
      lookupCard(scannedSetId, scannedNumber);
    }
  };

  const handleScanAgain = () => {
    resetState();
    if (!stream) {
      startCamera();
    }
  };

  const handleAddCard = () => {
    if (!matchedCard) return;
    const existing = findUserCardEntry(userCollectionMap, matchedCard);
    const currentQty = existing?.quantity || 0;

    if (currentQty > 0) {
      if (onQuantityChange) {
        onQuantityChange(existing.card_id || matchedCard.id, currentQty + 1);
      }
    } else {
      if (onToggleCard) {
        onToggleCard(matchedCard, matchedCard.market_price || 0);
      }
    }

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  if (!isOpen) return null;

  const userEntry = matchedCard ? findUserCardEntry(userCollectionMap, matchedCard) : null;
  const isOwned = !!(userEntry && userEntry.quantity > 0);
  const isWanted = !!(userEntry && userEntry.is_wanted === true);
  const currentQuantity = userEntry?.quantity || 0;

  return (
    <div className="modal-overlay" onClick={handleModalClose}>
      <div
        className="modal-content card-scanner-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scanner-header">
          <div className="scanner-title-group">
            <div className="scanner-header-icon-wrap">
              <Camera size={22} className="scanner-header-icon" />
            </div>
            <div>
              <h2 className="scanner-title">Card Camera Scanner</h2>
              <p className="scanner-subtitle">Scan card bottom code to add directly to collection</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={handleModalClose} title="Close Scanner">
            <X size={20} />
          </button>
        </div>

        <div className="scanner-body">
          {!matchedCard ? (
            <div className="scanner-viewport-container">
              {hasCameraAccess ? (
                <div className="scanner-video-wrapper">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="scanner-video-stream"
                  />
                  <div className="scanner-card-overlay">
                    <div className="scanner-card-guide">
                      <div className="scanner-guide-top">
                        <span>Align Pokémon Card</span>
                      </div>
                      <div className="scanner-code-target">
                        <span className="scanner-target-label">Align Card # & Set Code Here</span>
                        <div className="scanner-laser-line"></div>
                      </div>
                    </div>
                  </div>

                  {hasTorchSupport && (
                    <button
                      type="button"
                      className={`scanner-torch-btn ${torchEnabled ? 'active' : ''}`}
                      onClick={toggleTorch}
                      title="Toggle Flashlight"
                    >
                      <Zap size={18} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="scanner-no-camera">
                  <AlertCircle size={44} color="var(--color-danger)" />
                  <p className="scanner-no-camera-text">{errorMessage}</p>
                </div>
              )}

              {isScanning && (
                <div className="scanner-loading-overlay">
                  <RefreshCw size={36} className="spin-icon spin-animation" color="var(--color-primary)" />
                  <span className="scanner-status-text">{scanStatus}</span>
                </div>
              )}

              <div className="scanner-actions-bar">
                {hasCameraAccess && (
                  <button
                    type="button"
                    className="btn btn-primary scanner-capture-btn"
                    onClick={captureLiveFrame}
                    disabled={isScanning}
                  >
                    <Camera size={20} />
                    <span>Scan Card Now</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary scanner-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                >
                  <Upload size={18} />
                  <span>{hasCameraAccess ? 'Photo Upload' : 'Take / Upload Photo'}</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              {/* Quick Card # & Set search bar always accessible */}
              <form className="scanner-manual-refine" onSubmit={handleManualSearch}>
                <div className="scanner-refine-header">
                  <Sparkles size={14} color="var(--color-primary)" />
                  <span>Card Number & Set Finder</span>
                </div>
                <div className="scanner-refine-inputs">
                  <input
                    type="text"
                    className="scanner-num-input"
                    placeholder="Card # (e.g. 025 or 151)"
                    value={scannedNumber}
                    onChange={(e) => setScannedNumber(e.target.value)}
                  />
                  <select
                    className="scanner-set-select"
                    value={scannedSetId}
                    onChange={(e) => setScannedSetId(e.target.value)}
                  >
                    <option value="">Select Set...</option>
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn btn-primary scanner-search-trigger-btn"
                    disabled={isFetchingCard || !scannedNumber || !scannedSetId}
                    title="Find Card"
                  >
                    {isFetchingCard ? (
                      <RefreshCw size={16} className="spin-animation" />
                    ) : (
                      <Search size={16} />
                    )}
                  </button>
                </div>
                {rawOcrText && (
                  <div className="scanner-raw-feedback" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Detected text: &ldquo;{rawOcrText.slice(0, 60)}{rawOcrText.length > 60 ? '...' : ''}&rdquo;
                  </div>
                )}
              </form>

              {errorMessage && (
                <div className="scanner-error-toast">
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="scanner-result-view">
              <div className="scanner-result-card-preview">
                <img
                  src={matchedCard.image_url || matchedCard.image}
                  alt={matchedCard.name}
                  className="scanner-result-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = './assets/placeholder.png';
                  }}
                />
              </div>

              <div className="scanner-result-details">
                <div className="scanner-result-meta">
                  <span className="scanner-result-set-badge">{matchedCard.set?.name || scannedSetId.toUpperCase()}</span>
                  <span className="scanner-result-number">#{matchedCard.number}</span>
                  <span className="scanner-result-rarity">{matchedCard.rarity}</span>
                  {matchedCard.market_price > 0 && (
                    <span className="scanner-result-price">€{matchedCard.market_price.toFixed(2)}</span>
                  )}
                </div>

                <h3 className="scanner-result-name">{matchedCard.name}</h3>

                <div className="scanner-collection-status-pill">
                  {isOwned ? (
                    <span className="status-badge owned-status">
                      <Check size={14} /> In Binder ({currentQuantity} owned)
                    </span>
                  ) : (
                    <span className="status-badge missing-status">Not in Collection</span>
                  )}
                  {isWanted && (
                    <span className="status-badge wanted-status">
                      <Heart size={14} fill="#ff007f" /> On Wishlist
                    </span>
                  )}
                </div>

                <div className="scanner-result-actions">
                  <button
                    type="button"
                    className={`btn ${isOwned ? 'btn-secondary' : 'btn-primary'} scanner-action-btn`}
                    onClick={handleAddCard}
                  >
                    <Plus size={16} />
                    <span>{isOwned ? `+ Add Copy (${currentQuantity + 1})` : 'Add to Collection'}</span>
                  </button>

                  <button
                    type="button"
                    className={`btn btn-secondary scanner-action-btn ${isWanted ? 'wanted-active' : ''}`}
                    onClick={() => onToggleWanted && onToggleWanted(matchedCard)}
                  >
                    <Heart size={16} fill={isWanted ? '#ff007f' : 'none'} color={isWanted ? '#ff007f' : 'currentColor'} />
                    <span>{isWanted ? 'On Wishlist' : 'Add to Wishlist'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary scanner-action-btn"
                    onClick={() => {
                      if (onInspectCard) onInspectCard(matchedCard);
                      onClose();
                    }}
                  >
                    <ExternalLink size={15} />
                    <span>Details</span>
                  </button>
                </div>

                <div className="scanner-scan-next-wrap">
                  <button
                    type="button"
                    className="btn btn-primary scanner-next-btn"
                    onClick={handleScanAgain}
                  >
                    <RotateCcw size={16} />
                    <span>Scan Another Card</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
