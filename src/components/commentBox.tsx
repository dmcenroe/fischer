import React from "react";
import { useState } from "react";
export default function CommentBox() {
  const [comment, setComment] = useState<string>("");

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const commentValue = event.target.value;
    setComment(commentValue);
  };

  const handleCommentSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    console.log(comment);
  };
  return (
    <div className="flex justify-center ">
      <div className=" max-w-3xl w-full outline-1 outline-slate-400">
        <form
          onSubmit={(event) => {
            handleCommentSubmit(event);
          }}
          className="flex-col items-center mt-8 flex  border border-gray-600 rounded-lg"
        >
          <textarea
            id="textArea"
            onChange={(event) => {
              onChange(event);
            }}
            placeholder="What are your thoughts?"
            className="flex pt-2 pl-4 w-full  rounded-lg bg-gray-700 min-h-[150px]"
          ></textarea>
          <div className="flex w-full bg-gray-600 ">
            <div className="flex justify-end">
              <button className="px-4 py-2 bg-green-500 rounded-lg text-white">
                Comment
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
