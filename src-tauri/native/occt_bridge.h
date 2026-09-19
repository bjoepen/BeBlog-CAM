#pragma once

extern "C" char* beblog_occt_inspect_step(const char* path);

// 008H-N1 contract only. The request is a versioned UTF-8 JSON document and
// the response is a versioned UTF-8 JSON NativeZLevelRegionSet. N1 deliberately
// does not implement region construction; N2 owns the OCCT geometry algorithm.
extern "C" char* beblog_occt_build_zlevel_regions(const char* request_json);

extern "C" void beblog_occt_free_string(char* value);
