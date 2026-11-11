// Package imagefile tells the type of an image file by its content.
package imagefile

import "net/http"

// Type returns the content type and the file extension of the image in
// data. The type comes from the bytes of the file, not from what a client
// says. ok is false when data is not a JPEG, PNG or WebP image.
func Type(data []byte) (contentType, extension string, ok bool) {
	switch contentType = http.DetectContentType(data); contentType {
	case "image/jpeg":
		return contentType, "jpg", true
	case "image/png":
		return contentType, "png", true
	case "image/webp":
		return contentType, "webp", true
	default:
		return "", "", false
	}
}
