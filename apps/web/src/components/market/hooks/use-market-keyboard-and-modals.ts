import { useEffect, useState, useCallback } from "react";
import type React from "react";
import type { MarketSidePanelId } from "../chrome/market-side-rail";

export interface UseMarketKeyboardAndModalsParams {
  // Modais Principais (Hierarquia Nível 1)
  symbolDialogOpen: boolean;
  setSymbolDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  indicatorsDialogOpen: boolean;
  setIndicatorsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Popovers Flutuantes (Hierarquia Nível 2)
  favMenuOpen: boolean;
  setFavMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templatesMenuOpen: boolean;
  setTemplatesMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsNamingTemplate: React.Dispatch<React.SetStateAction<boolean>>;
  scrubOpen: boolean;
  setScrubOpen: React.Dispatch<React.SetStateAction<boolean>>;
  speedMenuOpen: boolean;
  setSpeedMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  datePickerOpen: boolean;
  setDatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Replay & Trading (Hierarquia Nível 3)
  isReplayActiveRef: React.RefObject<boolean>;
  isSelectingCutPointRef: React.MutableRefObject<boolean>;
  setIsSelectingCutPoint: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOrderTicketOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDomOpen?: React.Dispatch<React.SetStateAction<boolean>>;

  // Ações disparadas por atalhos
  handleTogglePlay?: () => void;
  handleStepForward?: () => void;

  // Single Source of Truth para Painéis Laterais (Camada 0)
  activeSidePanel?: MarketSidePanelId;
  setActiveSidePanel?: React.Dispatch<React.SetStateAction<MarketSidePanelId>>;
}

export interface UseMarketKeyboardAndModalsReturn {
  symbolDialogOpen: boolean;
  setSymbolDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeSidePanel: MarketSidePanelId;
  setActiveSidePanel: React.Dispatch<React.SetStateAction<MarketSidePanelId>>;
  closeAllFloatingPopovers: () => void;
}

export function useMarketKeyboardAndModals(
  params: UseMarketKeyboardAndModalsParams,
): UseMarketKeyboardAndModalsReturn {
  const {
    symbolDialogOpen,
    setSymbolDialogOpen,
    indicatorsDialogOpen,
    setIndicatorsDialogOpen,
    settingsOpen,
    setSettingsOpen,
    favMenuOpen,
    setFavMenuOpen,
    templatesMenuOpen,
    setTemplatesMenuOpen,
    setIsNamingTemplate,
    scrubOpen,
    setScrubOpen,
    speedMenuOpen,
    setSpeedMenuOpen,
    datePickerOpen,
    setDatePickerOpen,
    isReplayActiveRef,
    isSelectingCutPointRef,
    setIsSelectingCutPoint,
    setIsOrderTicketOpen,
    setIsDomOpen,
    handleTogglePlay,
    handleStepForward,
  } = params;

  const [internalSidePanel, setInternalSidePanel] = useState<MarketSidePanelId>(null);
  const activeSidePanel =
    params.activeSidePanel !== undefined ? params.activeSidePanel : internalSidePanel;
  const setActiveSidePanel = params.setActiveSidePanel || setInternalSidePanel;

  const closeAllFloatingPopovers = useCallback(() => {
    setFavMenuOpen(false);
    setTemplatesMenuOpen(false);
    setIsNamingTemplate(false);
    setScrubOpen(false);
    setSpeedMenuOpen(false);
    setDatePickerOpen(false);
  }, [
    setDatePickerOpen,
    setFavMenuOpen,
    setIsNamingTemplate,
    setScrubOpen,
    setSpeedMenuOpen,
    setTemplatesMenuOpen,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de input, textarea ou contenteditable
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Hierarquia do Escape: Modais > Popovers > Cut Mode
      if (e.key === "Escape") {
        if (symbolDialogOpen) {
          setSymbolDialogOpen(false);
          return;
        }
        if (indicatorsDialogOpen) {
          setIndicatorsDialogOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (
          favMenuOpen ||
          templatesMenuOpen ||
          scrubOpen ||
          speedMenuOpen ||
          datePickerOpen
        ) {
          closeAllFloatingPopovers();
          return;
        }
        if (isSelectingCutPointRef.current) {
          setIsSelectingCutPoint(false);
          return;
        }
        if (setIsOrderTicketOpen) {
          setIsOrderTicketOpen(false);
        }
        if (setIsDomOpen) {
          setIsDomOpen(false);
        }
        if (activeSidePanel) {
          setActiveSidePanel(null);
        }
        return;
      }

      if (isInput) return;

      // Atalho '/' para abrir busca de símbolo
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        closeAllFloatingPopovers();
        setSymbolDialogOpen(true);
        return;
      }

      // Atalhos de reprodução Replay
      if (isReplayActiveRef.current) {
        // Space: Play / Pause
        if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          handleTogglePlay?.();
          return;
        }

        // ArrowRight / Shift+ArrowRight: Step Forward
        if (e.key === "ArrowRight" && (e.shiftKey || !e.altKey)) {
          e.preventDefault();
          handleStepForward?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeSidePanel,
    closeAllFloatingPopovers,
    datePickerOpen,
    favMenuOpen,
    handleStepForward,
    handleTogglePlay,
    indicatorsDialogOpen,
    isReplayActiveRef,
    isSelectingCutPointRef,
    scrubOpen,
    setIsOrderTicketOpen,
    setIsDomOpen,
    setIsSelectingCutPoint,
    setIndicatorsDialogOpen,
    setSettingsOpen,
    setSymbolDialogOpen,
    settingsOpen,
    speedMenuOpen,
    symbolDialogOpen,
    templatesMenuOpen,
  ]);

  return {
    symbolDialogOpen,
    setSymbolDialogOpen,
    activeSidePanel,
    setActiveSidePanel,
    closeAllFloatingPopovers,
  };
}
