import React, { useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import {
  addPost,
  updateCursor,
  selectCursor,
  selectFilteredPosts,
  rehydrate,
  selectSearchData,
  fetchMoreSearchResults,
} from "@/redux/slices/allPostsSlice";
import Loading from "./loading";
import { useSession } from "next-auth/react";

interface Props {
  firstPosts: firstPosts[];
}

interface Scroll {
  infiniteScroll: boolean;
}
//THE ALL POSTS COMPONENT
const AllPosts: React.FC<Partial<Props> & Partial<Scroll>> = ({
  firstPosts,
}) => {
  const dispatch = useAppDispatch();
  const { data: session } = useSession();

  //state
  const [loading, setLoading] = React.useState<boolean>(false);
  const [userId, setUserId] = React.useState<number | null>(null);
  const [userCompliance, setUserCompliance] = React.useState<Array<object>>([]);
  const [votemAnimation, setVoteAnimation] = React.useState<boolean>(false);
  const [postClicked, setPostClicked] = React.useState<number | null>(null);
  const [filteredPosts, setFilteredPosts] = React.useState<any>(firstPosts);

  useEffect(() => {
    //if a session exists, set the userId
    if (session) {
      setUserId(session.user.fischerId);
    }
  }, [session]);

  useEffect(() => {
    //get the users vote history so we can hide the vote button if they have already voted
    const fetchUserCompliance = async () => {
      const data = await fetch(`/api/usercompliance/${userId}`);
      const complianceData = await data.json();
      setUserCompliance(complianceData);
    };

    if (userId) {
      fetchUserCompliance();
    }
  }, [userId]);

  const getFilteredPosts = useAppSelector(selectFilteredPosts);

  useEffect(() => {
    if (getFilteredPosts!.length > 0) {
      setFilteredPosts(getFilteredPosts);
    }
  }, [getFilteredPosts]);

  const getSearchData = useAppSelector(selectSearchData);

  //gets the cursor from redux so we know what posts to fetch on infinite scroll
  const cursor = useAppSelector(selectCursor);

  //observer and endOfScrollRef are what triggers the infinite scroll request
  const observer = React.useRef<IntersectionObserver | null>(null);
  const endOfScrollRef = React.useCallback<any>(
    (node: HTMLElement) => {
      //trottle function prevents a user from scrolling super fast and spamming get requests too quickly
      let throttleTimer: boolean;

      function throttle(callback: Function, time: number) {
        if (throttleTimer) {
          return;
        }
        throttleTimer = true;
        setTimeout(() => {
          callback();
          throttleTimer = false;
        }, time);
      }

      //handleRefresh requests more posts from the db
      const handleRefresh = async (cursor: number) => {
        const morePosts = await fetch(`/api/posts/request/${cursor}`);
        const data = await morePosts.json();

        data.posts.forEach((post: firstPosts) => {
          dispatch(addPost(post));
        });
        //setting the new cursor
        dispatch(updateCursor(data.newCursor));
        setLoading(false);
      };

      const handleSearchRefresh = () => {
        if (getSearchData.searchResults.length > 1) {
          dispatch(fetchMoreSearchResults(getSearchData));
        }

        setLoading(false);
      };

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (getSearchData.searchCursor) {
            if (getSearchData.searchResults.length > 1) {
              setLoading(true);
            }
            throttle(() => {
              handleSearchRefresh();
            }, 600);
          } else {
            setLoading(true);
            throttle(() => {
              handleRefresh(cursor);
            }, 600);
          }
        }
      });

      if (node) observer.current.observe(node);
    },
    [cursor, dispatch, getSearchData]
  );

  const submitVote = async (compliance: number, postId: number) => {
    const userComplicance = {
      fischerId: userId,
      postId: postId,
      compliance: compliance,
    };

    const response = await fetch("/api/usercompliance", {
      method: "POST",
      body: JSON.stringify(userComplicance),
    });
    const data = await response.json();

    setVoteAnimation(true);
    setPostClicked(postId);
  };

  const handleTrueVote = (postId: number) => {
    submitVote(1, postId);
    setUserCompliance([
      ...userCompliance,
      ...[{ postId, fischerId: userId, compliance: 1 }],
    ]);
  };

  const handleSubjVote = (postId: number) => {
    submitVote(0, postId);
    setUserCompliance([
      ...userCompliance,
      ...[{ postId, fischerId: userId, compliance: 0 }],
    ]);
  };

  const handleFalseVote = (postId: number) => {
    submitVote(-1, postId);
    setUserCompliance([
      ...userCompliance,
      ...[{ postId, fischerId: userId, compliance: -1 }],
    ]);
  };

  const getTruthiness = (post) => {
    //Truthiness is the average of:
    // Average User Compliance
    // Average Expert Compliance
    // AI Compliance

    // Display as a percentage to indicate truthiness
    // 16% to 100% = green
    // -15% to +15% = yellow
    // -16% to -100% = red

    const aiAverage = post.aiCompliance;
    let expertAverage = null;
    let userAverage = null;

    //get the average expert compliance
    if (post.expertResponses.length > 0) {
      expertAverage =
        post.expertCompliances
          .map((vote) => {
            return vote.compliance;
          })
          .reduce((a, b) => {
            return a + b;
          }) / post.expertCompliances.length;
    }
    //get the average user compliance
    if (post.userCompliances.length > 0) {
      userAverage =
        post.userCompliances
          .map((vote) => {
            return vote.compliance;
          })
          .reduce((a, b) => {
            return a + b;
          }) / post.userCompliances.length;
    }

    //filter out the nulls so average will be accurate
    const allAverages = [userAverage, expertAverage, aiAverage].filter(
      (category) => {
        return category !== null;
      }
    );

    //average the available values together, and return the % value
    const averageTruthiness =
      allAverages.reduce((a, b) => {
        return a + b;
      }) / allAverages.length;

    return `${averageTruthiness * 100}%`;
  };

  return (
    <div>
      {filteredPosts!.length > 0 &&
        filteredPosts!.map((post, index) => {
          return (
            <div
              key={post.id}
              className="grid grid-cols-1 gap-4 my-4 md:grid-cols-1 lg:grid-cols-1 relative w-full px-4 py-6 bg-white shadow-lg dark:bg-gray-700"
            >
              <div>
                {/* Begin website indicator */}
                <div className="bg-purple-500 text-sm w-max inline-flex font-semibold pl-4 pr-4 pt-2 pb-2 mr-12 rounded-full rounded-tl-none hover:bg-purple-400">
                  <a href={post.websiteArticle.articleURL}>
                    {post.websiteArticle.website.hostSite.slice(
                      post.websiteArticle.website.hostSite.indexOf(".") + 1
                    )}
                  </a>
                </div>
                {/* End website indicator */}

                {/* Begin post categories */}
                <div className="inline-flex gap-2 w-max">
                  <div className="bg-red-500 text-sm w-max inline font-semibold rounded-full pl-3 pr-3 pt-1 pb-1">
                    {post.topicName}
                  </div>
                </div>
                {/* End post categories */}

                {/* Post User Name */}
                <div className="inline-flex gap-2 float-right items-center">
                  {post.user ? (
                    <p className="inline float-right text-xs">
                      {post.user.name}
                    </p>
                  ) : (
                    <p className="inline float-right text-xs">deleted user</p>
                  )}
                  <div className="mx-auto object-cover inline float-right rounded-full bg-white h-10 w-10 "></div>
                </div>
              </div>
              {/* Main Section of Card */}
              <div className="flex items-end space-x-2">
                <section className="flex flex-col gap-y-5">
                  {/* Assertion */}
                  <div className="border-l-2 border-orange-500 p-4">
                    <div className="flex h-max mb-4">
                      <p className="font-bold text-lg w-max pl-2 pr-2.5">
                        Assertion
                      </p>
                      {/* start voting buttons */}
                      {userId ? (
                        <div>
                          {userCompliance.find((x) => x.postId === post.id) ? (
                            <div className="flex items-center">
                              <div className="group relative flex items-center">
                                <span className="material-symbols-outlined hover:cursor-pointer">
                                  beenhere
                                </span>
                                <span
                                  className="group-hover:opacity-100  transition-opacity bg-gray-800 px-2 py-1 text-xs text-gray-100 rounded-md absolute left-1/2 
                                      -translate-x-1/2 -translate-y-full mt-1 opacity-0 m-4 mx-auto w-max"
                                >
                                  You&#39;ve already voted.
                                </span>
                              </div>
                              <span
                                className={`${
                                  votemAnimation && post.id === postClicked
                                    ? "animate-fade"
                                    : "opacity-0"
                                } opacity-0 text-xs ml-2`}
                                onAnimationEnd={() => setVoteAnimation(false)}
                              >
                                Thank you for voting. Your feedback matters.
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-beginning gap-1 items-center">
                              <button
                                onClick={() => {
                                  handleTrueVote(post.id);
                                }}
                                className="flex group justify-center items-center relative"
                              >
                                <span
                                  className="group-hover:opacity-100 transition-opacity bg-gray-800 px-2 py-1 text-xs text-gray-100 rounded-md absolute left-1/2 
                                      -translate-x-1/2 -translate-y-full mt-1 opacity-0 m-4 mx-auto w-max"
                                >
                                  Assertion is true
                                </span>
                                <span className="material-symbols-outlined text-emerald-600 hover:text-emerald-400">
                                  verified_user
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  handleSubjVote(post.id);
                                }}
                                className="flex group justify-center items-center relative"
                              >
                                <span
                                  className="group-hover:opacity-100 transition-opacity bg-gray-800 px-2 py-1 text-xs text-gray-100 rounded-md absolute left-1/2 
                                      -translate-x-1/2 -translate-y-full mt-1 opacity-0 m-4 mx-auto w-max"
                                >
                                  Assertion is Subjective
                                </span>
                                <span className="material-symbols-outlined text-amber-400 hover:text-amber-300">
                                  gpp_maybe
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  handleFalseVote(post.id);
                                }}
                                className="flex group justify-center items-center relative"
                              >
                                <span
                                  className="group-hover:opacity-100 transition-opacity bg-gray-800 px-2 py-1 text-xs text-gray-100 rounded-md absolute left-1/2 
                                      -translate-x-1/2 -translate-y-full mt-1 opacity-0 m-4 mx-auto w-max"
                                >
                                  Assertion is False
                                </span>
                                <span className="material-symbols-outlined text-red-400 hover:text-red-300">
                                  gpp_bad
                                </span>{" "}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {/* end voting buttons */}
                    </div>
                    <div className="w-full h-1/12 p-2 text-gray-700 dark:text-white text-sm font-sans relative">
                      <span className="text-4xl font-serif absolute -left-2 -top-2">
                        &#8220;
                      </span>
                      {post.assertion}
                      <span className="text-4xl font-serif absolute -bottom-5 pl-1.5">
                        &#8221;
                      </span>
                    </div>
                  </div>
                  {/* AI Response */}
                  <div className="border-l-2 border-yellow-500 p-4">
                    <p className="mb-4 font-bold text-lg  w-max pl-2 pr-2">
                      AI Response
                    </p>
                    <div className="w-full relative h-1/12 text-gray-700 dark:text-white text-sm font-sans p-2">
                      <span className="text-4xl font-serif absolute -left-2 -top-2">
                        &#8220;
                      </span>
                      {post.aiResponse}
                      <span className="text-4xl font-serif absolute -bottom-5 pl-1.5">
                        &#8221;
                      </span>
                    </div>
                  </div>
                </section>
              </div>
              {/* Comments */}
              <div className="flex items-center">
                <div className="w-full">
                  <div className="text-sm hover:underline underline-offset-4 cursor-pointer">
                    {post.comments
                      ? post.comments.length === 1
                        ? `${post.comments.length} comment`
                        : `${post.comments} comments`
                      : `0 comments`}
                  </div>
                </div>
              </div>
              {/* Begin Post Stats */}
              <div className="dark:text-white flex gap-2 justify-between mt-6">
                <div className="flex items-center space-x-3 text-sm">
                  <p>Truthiness</p>
                  <div className="flex items-end text-xs">
                    <div>{getTruthiness(post)}</div>
                    <span className="flex items-center">
                      <svg
                        width="20"
                        fill="currentColor"
                        height="20"
                        className="h-3 text-red-500 transform rotate-180"
                        viewBox="0 0 1792 1792"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M1675 971q0 51-37 90l-75 75q-38 38-91 38-54 0-90-38l-294-293v704q0 52-37.5 84.5t-90.5 32.5h-128q-53 0-90.5-32.5t-37.5-84.5v-704l-294 293q-36 38-90 38t-90-38l-75-75q-38-38-38-90 0-53 38-91l651-651q35-37 90-37 54 0 91 37l651 651q37 39 37 91z"></path>
                      </svg>
                      12%
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <p>Interest</p>
                  <div className="flex items-end text-xs">
                    {/* {post.truthVotes.yellow} */}
                    <span className="flex items-center">
                      <svg
                        width="20"
                        fill="currentColor"
                        height="20"
                        className="h-3 text-green-500"
                        viewBox="0 0 1792 1792"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M1675 971q0 51-37 90l-75 75q-38 38-91 38-54 0-90-38l-294-293v704q0 52-37.5 84.5t-90.5 32.5h-128q-53 0-90.5-32.5t-37.5-84.5v-704l-294 293q-36 38-90 38t-90-38l-75-75q-38-38-38-90 0-53 38-91l651-651q35-37 90-37 54 0 91 37l651 651q37 39 37 91z"></path>
                      </svg>
                      10%
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm">
                  <p>Divisiveness</p>
                  <div className="flex items-end text-xs">
                    {/* {post.truthVotes.red} */}
                    <span className="flex items-center">
                      <svg
                        width="20"
                        fill="currentColor"
                        height="20"
                        className="h-3 text-red-500 transform rotate-180"
                        viewBox="0 0 1792 1792"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M1675 971q0 51-37 90l-75 75q-38 38-91 38-54 0-90-38l-294-293v704q0 52-37.5 84.5t-90.5 32.5h-128q-53 0-90.5-32.5t-37.5-84.5v-704l-294 293q-36 38-90 38t-90-38l-75-75q-38-38-38-90 0-53 38-91l651-651q35-37 90-37 54 0 91 37l651 651q37 39 37 91z"></path>
                      </svg>
                      4%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      <div ref={endOfScrollRef}></div>
      {loading ? <Loading /> : null}
    </div>
  );
};

export default AllPosts;
