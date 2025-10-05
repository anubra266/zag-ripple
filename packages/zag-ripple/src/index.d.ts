import type { Machine, Scope } from "@zag-js/core";
import { Component } from "ripple";

export { mergeProps } from "@zag-js/core";

// From normalize-props.ripple
import { NormalizeProps, PropTypes } from "@zag-js/types";
export declare const normalizeProps: NormalizeProps<PropTypes>;

// From machine.ripple  
export interface MachineApi<TContext = Record<string, any>, TState extends string = string> {
    state: {
        value: TState;
        matches(...values: TState[]): boolean;
        hasTag(tag: string): boolean;
        get(): TState;
    };
    send: (event: { type: string;[key: string]: any }) => void;
    context: {
        get(key: keyof TContext): any;
        set(key: keyof TContext, value: any): void;
        initial(key: keyof TContext): any;
        hash(key: keyof TContext): string;
    };
    prop: (key: string) => any;
    scope: Scope;
    refs: Record<string, { current: any }>;
    computed: (key: string) => any;
    event: {
        type: string;
        current(): any;
        previous(): any;
        [key: string]: any;
    };
    getStatus: () => "started" | "stopped" | "not_started";
}

export interface MachineOptions {
    id?: string;
    ids?: Record<string, string>;
    getRootNode?: () => Document | ShadowRoot | Node;
}

export declare function useMachine<
    TContext = Record<string, any>,
    TState extends string = string
>(
    machine: Machine<TContext>,
    options?: MachineOptions | (() => MachineOptions)
): MachineApi<TContext, TState>;




export interface PortalProps {
    disabled?: boolean | undefined
    container?: HTMLElement | undefined
    getRootNode?: (() => ShadowRoot | Document | Node) | undefined
    children: Component
}

export declare const Portal: Component<PortalProps>;
// export declare function Portal(props: PortalProps): Component;

