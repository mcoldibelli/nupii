package httpx

import (
	"errors"
	"io"
	"mime/multipart"
)

// _maxFieldBytes is the maximum size of a text field of a multipart body.
// The longest text of the API has 1.000 characters (RN-70).
const _maxFieldBytes = 4 << 10

// Form has the parts of a multipart body.
type Form struct {
	// Fields has the text of each part that is not the file.
	Fields map[string]string
	// File has the content of the part "file", or nil.
	File []byte
	// FileName is the name of the part "file", as the client gives it.
	FileName string
}

// ReadForm reads the parts of a multipart body. The part "file" can have at
// most maxFileBytes and one byte more: the caller tells a file that is too
// big by its size. The message of an error can go to the client.
func ReadForm(body *multipart.Reader, maxFileBytes int64) (Form, error) {
	result := Form{Fields: make(map[string]string)}
	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			return result, nil
		}
		if err != nil {
			return Form{}, errors.New("the multipart body could not be read")
		}
		limit := int64(_maxFieldBytes)
		if part.FormName() == "file" {
			limit = maxFileBytes
		}
		// One byte over the limit is enough to know that the part is too big.
		data, err := io.ReadAll(io.LimitReader(part, limit+1))
		if err != nil {
			return Form{}, errors.New("the multipart body could not be read")
		}
		if part.FormName() == "file" {
			result.File = data
			result.FileName = part.FileName()
			continue
		}
		if int64(len(data)) > limit {
			return Form{}, errors.New("the field " + part.FormName() + " is too long")
		}
		result.Fields[part.FormName()] = string(data)
	}
}
