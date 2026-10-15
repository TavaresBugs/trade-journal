export interface VelaIndicatorInstanceConfig {
  slug: string;
  name?: string;
  code?: string;
  inputs?: Record<string, unknown>;
  style?: Record<string, unknown>;
  props?: Record<string, unknown>;
  visible?: boolean;
}

export interface VelaIndicatorPreset {
  inputs?: Record<string, unknown>;
  style?: Record<string, unknown>;
  props?: Record<string, unknown>;
  visible?: boolean;
}

export interface ApplyPineScriptResult {
  success: boolean;
  indicatorId?: string;
  error?: string;
}

function applyHandleConfig(
  handle: any,
  inputs?: Record<string, unknown>,
  props?: Record<string, unknown>,
  visible?: boolean,
): void {
  if (!handle) return;
  try {
    if (inputs && Object.keys(inputs).length > 0) {
      handle.setInputs?.(inputs);
    }
  } catch {}
  try {
    if (props && Object.keys(props).length > 0) {
      handle.setProps?.(props);
    }
  } catch {}
  try {
    if (typeof visible === "boolean") {
      handle.setVisible?.(visible);
    }
  } catch {}
}

/**
 * Compila e injeta código Pine Script v6 diretamente em uma instância Vela,
 * restaurando inputs/styles caso um preset ou config persistida seja fornecido.
 * Trata colisões de ID reutilizando o handle existente com updateCode.
 */
export async function compileAndMountPineScript(
  chartInstance: any,
  code: string,
  title: string,
  restoredConfig?: VelaIndicatorInstanceConfig,
  preset?: VelaIndicatorPreset,
): Promise<ApplyPineScriptResult> {
  if (!chartInstance) {
    return { success: false, error: "Chart instance not ready" };
  }
  if (!code || typeof code !== "string" || !code.trim()) {
    return { success: false, error: "Pine script code cannot be empty" };
  }

  const effectiveInputs = (restoredConfig?.inputs ?? preset?.inputs) as Record<string, unknown> | undefined;
  const effectiveProps = (restoredConfig?.props ?? restoredConfig?.style ?? preset?.props ?? preset?.style) as Record<string, unknown> | undefined;
  const effectiveVisible = restoredConfig?.visible ?? preset?.visible;
  const targetId = restoredConfig?.slug || `pine_${Date.now()}`;

  try {
    const liveList = typeof chartInstance.indicators === "function" ? chartInstance.indicators() ?? [] : [];

    // Evita colisão fatal de ID verificando se o indicador já está montado na cena
    let handle = liveList.find(
      (h: any) => h.id === targetId || (title && (h.title === title || h.name === title)),
    );

    if (handle) {
      if (typeof handle.updateCode === "function") {
        await handle.updateCode(code);
      }
      applyHandleConfig(handle, effectiveInputs, effectiveProps, effectiveVisible);
      return { success: true, indicatorId: handle.id ?? targetId };
    }

    if (typeof chartInstance.addIndicator === "function") {
      handle = await chartInstance.addIndicator(code, {
        id: targetId,
        title: title || restoredConfig?.name || "Pine Script",
        ...(effectiveInputs ? { inputs: effectiveInputs } : {}),
        ...(effectiveProps ? { props: effectiveProps } : {}),
      });
    }

    if (!handle && typeof chartInstance.indicators === "function") {
      const updatedList = chartInstance.indicators() ?? [];
      handle = updatedList.find((h: any) => h.id === targetId || h.title === title);
    }

    if (handle) {
      applyHandleConfig(handle, effectiveInputs, effectiveProps, effectiveVisible);
      return { success: true, indicatorId: handle.id ?? targetId };
    }

    return {
      success: false,
      error: `Failed to mount indicator "${targetId}" on chart instance`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to compile or mount Pine Script",
    };
  }
}

/**
 * Monta um indicador nativo registrado no Vela (ex: volume profile, order flow, fills).
 */
export async function mountNativeVelaIndicator(
  chartInstance: any,
  type: string,
  restoredConfig?: VelaIndicatorInstanceConfig,
  preset?: VelaIndicatorPreset,
): Promise<ApplyPineScriptResult> {
  if (!chartInstance) {
    return { success: false, error: "Chart instance not ready" };
  }
  if (!type || typeof type !== "string") {
    return { success: false, error: "Native indicator type is required" };
  }

  const effectiveInputs = (restoredConfig?.inputs ?? preset?.inputs) as Record<string, unknown> | undefined;
  const effectiveProps = (restoredConfig?.props ?? restoredConfig?.style ?? preset?.props ?? preset?.style) as Record<string, unknown> | undefined;
  const effectiveVisible = restoredConfig?.visible ?? preset?.visible;

  try {
    const liveList = typeof chartInstance.indicators === "function" ? chartInstance.indicators() ?? [] : [];
    let handle = liveList.find(
      (h: any) => h.id === `native:${type}` || h.nativeType === type || h.type === type,
    );

    if (!handle && typeof chartInstance.addNativeIndicator === "function") {
      handle = await chartInstance.addNativeIndicator(type);
      if (!handle && typeof chartInstance.indicators === "function") {
        const updatedList = chartInstance.indicators() ?? [];
        handle = updatedList.find(
          (h: any) => h.id === `native:${type}` || h.nativeType === type || h.type === type,
        );
      }
    }

    if (handle) {
      applyHandleConfig(handle, effectiveInputs, effectiveProps, effectiveVisible);
      return { success: true, indicatorId: handle.id ?? `native:${type}` };
    }

    return {
      success: false,
      error: `Failed to mount native indicator "${type}" on chart instance`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || `Failed to mount native indicator ${type}`,
    };
  }
}

/**
 * Extrai a lista atual de indicadores ativos e seus inputs/styles customizados
 * diretamente da cena/orquestrador da instância Vela para persistência.
 * Lê preferencialmente inputValues() e propValues() para evitar schemas de UI.
 */
export function extractMountedIndicatorsFromChart(
  chartInstance: any,
): {
  slugs: string[];
  configs: VelaIndicatorInstanceConfig[];
  presetsBySlug: Record<string, VelaIndicatorPreset>;
} {
  const slugs: string[] = [];
  const configs: VelaIndicatorInstanceConfig[] = [];
  const presetsBySlug: Record<string, VelaIndicatorPreset> = {};

  if (!chartInstance || typeof chartInstance.indicators !== "function") {
    return { slugs, configs, presetsBySlug };
  }

  try {
    const liveList = chartInstance.indicators() ?? [];
    for (const h of liveList) {
      try {
        const rawId = h.id || h.nativeType || h.type || "";
        if (!rawId) continue;

        let canonicalSlug = rawId;
        if (h.nativeType || rawId.startsWith("native:")) {
          canonicalSlug = rawId.startsWith("native:") ? rawId : `native:${rawId}`;
        } else if (rawId.startsWith("personal:")) {
          canonicalSlug = rawId;
        } else if (rawId.startsWith("slug:")) {
          canonicalSlug = rawId.slice(5);
        } else if (rawId.startsWith("builtin:")) {
          canonicalSlug = rawId.slice(8);
        }

        if (!slugs.includes(canonicalSlug)) {
          slugs.push(canonicalSlug);
        }

        // Lê valores reais dos inputs (inputValues()) e props (propValues()),
        // evitando os schemas de metadados retornados por h.inputs e h.props
        const inputs =
          typeof h.inputValues === "function"
            ? h.inputValues()
            : typeof h.getInputs === "function"
              ? h.getInputs()
              : h.inputs && !Array.isArray(h.inputs)
                ? h.inputs
                : undefined;

        const props =
          typeof h.propValues === "function"
            ? h.propValues()
            : typeof h.getProps === "function"
              ? h.getProps()
              : h.props && !Array.isArray(h.props)
                ? h.props
                : undefined;

        const visible =
          typeof h.visible === "boolean"
            ? h.visible
            : typeof h.getVisible === "function"
              ? h.getVisible()
              : undefined;

        const configEntry: VelaIndicatorInstanceConfig = {
          slug: canonicalSlug,
          name: h.title || h.name,
          inputs: inputs ? { ...inputs } : undefined,
          style: props ? { ...props } : undefined,
          props: props ? { ...props } : undefined,
          visible,
        };
        configs.push(configEntry);

        if (inputs || props || typeof visible === "boolean") {
          presetsBySlug[canonicalSlug] = {
            inputs: inputs ? { ...inputs } : undefined,
            style: props ? { ...props } : undefined,
            props: props ? { ...props } : undefined,
            visible,
          };
        }
      } catch (indicatorErr) {
        console.warn("[PineRuntime] Failed to extract data for indicator:", indicatorErr);
      }
    }
  } catch (err) {
    console.warn("[PineRuntime] Failed to read indicators list from chart:", err);
  }

  return { slugs, configs, presetsBySlug };
}
