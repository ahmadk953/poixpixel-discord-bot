export function recursive_merge(
    defaulted: any,
    target: any
) {
    let output = defaulted;

    Object.keys(target).forEach((target_key) => {
        if (typeof target_key != "object") {
            output[target_key] = target[target_key];
        } else {
            output[target_key] = recursive_merge(defaulted[target_key], target[target_key]);
        }
    });

    return output;
}