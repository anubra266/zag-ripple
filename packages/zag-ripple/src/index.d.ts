import type {
    Bindable,
    BindableParams,
    Machine,
    MachineSchema,
    Service,
} from "@zag-js/core";
import type { Component } from "ripple";

// Re-export from @zag-js/core
export { mergeProps } from "@zag-js/core";

// Bindable function and related types
export declare function bindable<T>(props: () => BindableParams<T>): Bindable<T>;
export declare namespace bindable {
    function cleanup(fn: VoidFunction): void;
    function ref<T>(defaultValue: T): { get(): T; set(next: T): void };
}

// Machine hook
export declare function useMachine<T extends MachineSchema>(
    machine: Machine<T>,
    userProps?: Partial<T["props"]>
): Service<T>;

// Normalize props functionality
export declare function normalizeProps<T extends Record<string, any>>(
    props: T
): T;

export declare function toStyleString(style: Record<string, number | string>): string;

// Portal component and types
type RootNode = ShadowRoot | Document | Node;
type GetRootNode = () => RootNode;

export interface PortalActionProps {
    disabled?: boolean | undefined;
    container?: HTMLElement | undefined;
    getRootNode?: GetRootNode | undefined;
}

export interface PortalProps extends PortalActionProps {
    children?: Component;
}

export declare function Portal(props: PortalProps): void;

// Refs hook
export declare function useRefs<T>(refs: T): {
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
};

// Track utility
export declare function createTrack(
    deps: any[],
    effectCallback: VoidFunction
): void;






