import { invoke } from "@tauri-apps/api/core";

/**
 * Unified service utility for consistent Tauri command invocation and error handling
 */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, any>
): Promise<T> {
  try {
    const result = await invoke<T>(command, args);
    return result;
  } catch (error) {
    if (typeof error === "string") {
      throw new Error(error);
    } else if (error && typeof error === "object" && "message" in error) {
      throw new Error(error.message as string);
    } else {
      throw new Error(`Unknown error in ${command}: ${JSON.stringify(error)}`);
    }
  }
}

/**
 * Simplified wrapper for commands that don't need custom error handling
 */
export function createServiceFunction<T>(command: string) {
  return (args?: Record<string, any>): Promise<T> => {
    return invokeCommand<T>(command, args);
  };
}

/**
 * Creates a service function with parameter mapping for cleaner API
 */
export function createServiceFunctionWithArgs<T, TArgs = any>(
  command: string,
  paramMapper?: (args: TArgs) => Record<string, any>
) {
  return (args: TArgs): Promise<T> => {
    const mappedArgs = paramMapper ? paramMapper(args) : args as Record<string, any>;
    return invokeCommand<T>(command, mappedArgs);
  };
}
