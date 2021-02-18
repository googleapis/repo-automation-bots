cd "$GOOGLEAPIS" \
    && bazel query $BAZEL_FLAGS 'filter("-(go|csharp|java|php|ruby|nodejs|py)\.tar\.gz$", kind("generated file", //...:*))' \
    | grep -v -E ":(proto|grpc|gapic)-.*-java\.tar\.gz$"